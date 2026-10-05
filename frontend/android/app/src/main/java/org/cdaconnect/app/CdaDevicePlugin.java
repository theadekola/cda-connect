package org.cdaconnect.app;

import android.os.StatFs;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CdaDevice")
public class CdaDevicePlugin extends Plugin {
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
}
