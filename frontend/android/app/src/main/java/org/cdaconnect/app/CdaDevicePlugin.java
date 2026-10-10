package org.cdaconnect.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.StatFs;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "CdaDevice", permissions = {
    @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
})
public class CdaDevicePlugin extends Plugin {
    private Ringtone ringtone;
    private AudioManager audioManager() {
        return (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
    }

    private boolean canUseBluetooth() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isBluetooth(AudioDeviceInfo device) {
        int type = device.getType();
        return type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == AudioDeviceInfo.TYPE_BLE_HEADSET);
    }

    private AudioDeviceInfo findDevice(String route) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null;
        for (AudioDeviceInfo device : audioManager().getAvailableCommunicationDevices()) {
            if ("bluetooth".equals(route) && isBluetooth(device)) return device;
            if ("speaker".equals(route) && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return device;
            if ("earpiece".equals(route) && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) return device;
        }
        return null;
    }

    private boolean bluetoothAvailable() {
        if (!canUseBluetooth()) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return findDevice("bluetooth") != null;
            return audioManager().isBluetoothScoAvailableOffCall();
        } catch (SecurityException ignored) { return false; }
    }

    private String activeRoute() {
        AudioManager manager = audioManager();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo device = manager.getCommunicationDevice();
                if (device != null && isBluetooth(device)) return "bluetooth";
                if (device != null && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return "speaker";
                return "earpiece";
            }
            if (manager.isBluetoothScoOn()) return "bluetooth";
            return manager.isSpeakerphoneOn() ? "speaker" : "earpiece";
        } catch (SecurityException ignored) { return manager.isSpeakerphoneOn() ? "speaker" : "earpiece"; }
    }

    private JSObject routesResult() {
        JSObject result = new JSObject();
        com.getcapacitor.JSArray available = new com.getcapacitor.JSArray();
        JSObject labels = new JSObject();
        available.put("earpiece");
        available.put("speaker");
        labels.put("earpiece", Build.MODEL);
        labels.put("speaker", "Speaker");
        if (bluetoothAvailable() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !canUseBluetooth())) {
            available.put("bluetooth");
            AudioDeviceInfo bluetooth = findDevice("bluetooth");
            labels.put("bluetooth", bluetooth != null && bluetooth.getProductName() != null ? bluetooth.getProductName().toString() : "Bluetooth");
        }
        result.put("available", available);
        result.put("active", activeRoute());
        result.put("labels", labels);
        return result;
    }

    private void applyRoute(PluginCall call, String route) {
        AudioManager manager = audioManager();
        manager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if ("earpiece".equals(route)) {
                    manager.clearCommunicationDevice();
                    manager.setSpeakerphoneOn(false);
                }
                AudioDeviceInfo device = findDevice(route);
                if (device == null || !manager.setCommunicationDevice(device)) {
                    call.reject("The selected audio device is not available");
                    return;
                }
            } else {
                if ("bluetooth".equals(route)) {
                    manager.setSpeakerphoneOn(false);
                    manager.startBluetoothSco();
                    manager.setBluetoothScoOn(true);
                } else {
                    manager.setBluetoothScoOn(false);
                    manager.stopBluetoothSco();
                    manager.setSpeakerphoneOn("speaker".equals(route));
                }
            }
            call.resolve(routesResult());
        } catch (SecurityException error) { call.reject("Bluetooth permission is required", error); }
    }
    @PluginMethod
    public void storage(PluginCall call) {
        try {
            StatFs disk = new StatFs(getContext().getFilesDir().getAbsolutePath());
            JSObject result = new JSObject();
            result.put("total", disk.getTotalBytes());
            result.put("free", disk.getAvailableBytes());
            call.resolve(result);
        } catch (Exception error) { call.reject("Unable to read phone storage", error); }
    }
    @PluginMethod
    public void pushConfiguration(PluginCall call) {
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("configured", id != 0);
        call.resolve(result);
    }

    @PluginMethod
    public void beginCall(PluginCall call) {
        AudioManager manager = audioManager();
        manager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        String preferred = call.getBoolean("speaker", false) ? "speaker" : "earpiece";
        applyRoute(call, preferred);
    }

    @PluginMethod
    public void audioRoutes(PluginCall call) { call.resolve(routesResult()); }

    @PluginMethod
    public void setAudioRoute(PluginCall call) {
        String route = call.getString("route", "earpiece");
        if (!route.equals("earpiece") && !route.equals("speaker") && !route.equals("bluetooth")) {
            call.reject("Unknown audio route"); return;
        }
        if (route.equals("bluetooth") && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "bluetoothPermissionCallback"); return;
        }
        applyRoute(call, route);
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) { call.reject("Bluetooth permission was not granted"); return; }
        applyRoute(call, "bluetooth");
    }

    @PluginMethod
    public void endCall(PluginCall call) {
        AudioManager manager = audioManager();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) manager.clearCommunicationDevice();
            else { manager.setBluetoothScoOn(false); manager.stopBluetoothSco(); manager.setSpeakerphoneOn(false); }
        } catch (SecurityException ignored) { /* Restore the remaining audio state below. */ }
        manager.setMode(AudioManager.MODE_NORMAL);
        call.resolve();
    }

    @PluginMethod
    public void startRingtone(PluginCall call) {
        try {
            if (ringtone != null && ringtone.isPlaying()) { call.resolve(); return; }
            Uri uri = RingtoneManager.getActualDefaultRingtoneUri(getContext(), RingtoneManager.TYPE_RINGTONE);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            ringtone = RingtoneManager.getRingtone(getContext(), uri);
            if (ringtone == null) { call.reject("No phone ringtone is configured"); return; }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
            ringtone.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ringtone.play();
            call.resolve();
        } catch (Exception error) { call.reject("Unable to play the phone ringtone", error); }
    }

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        if (ringtone != null) { ringtone.stop(); ringtone = null; }
        call.resolve();
    }
}
