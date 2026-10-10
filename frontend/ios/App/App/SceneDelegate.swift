import UIKit
import Capacitor
import AVFoundation
import AudioToolbox

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CdaBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

class CdaBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CdaDevicePlugin())
    }
}

@objc(CdaDevicePlugin)
public class CdaDevicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CdaDevicePlugin"
    public let jsName = "CdaDevice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "storage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pushConfiguration", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "audioRoutes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAudioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRingtone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRingtone", returnType: CAPPluginReturnPromise)
    ]
    @objc func storage(_ call: CAPPluginCall) {
        do {
            let values = try FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())
            guard let total = values[.systemSize] as? NSNumber,
                  let free = values[.systemFreeSize] as? NSNumber else {
                call.reject("Unable to read phone storage"); return
            }
            call.resolve(["total": total.doubleValue, "free": free.doubleValue])
        } catch { call.reject("Unable to read phone storage", nil, error) }
    }
    @objc func pushConfiguration(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["configured": true, "environment": "sandbox"])
        #else
        call.resolve(["configured": true, "environment": "production"])
        #endif
     }

    private let audioSession = AVAudioSession.sharedInstance()
    private var ringtoneTimer: Timer?

    private func isBluetooth(_ port: AVAudioSession.Port) -> Bool {
        return port == .bluetoothHFP || port == .bluetoothA2DP || port == .bluetoothLE
    }

    private func bluetoothInput() -> AVAudioSessionPortDescription? {
        return audioSession.availableInputs?.first(where: { isBluetooth($0.portType) })
    }

    private func routeResult() -> [String: Any] {
        var available = ["earpiece", "speaker"]
        var labels = ["earpiece": UIDevice.current.name, "speaker": "Speaker"]
        if bluetoothInput() != nil || audioSession.currentRoute.outputs.contains(where: { isBluetooth($0.portType) }) {
            available.append("bluetooth")
            labels["bluetooth"] = bluetoothInput()?.portName ?? audioSession.currentRoute.outputs.first(where: { isBluetooth($0.portType) })?.portName ?? "Bluetooth"
        }
        let output = audioSession.currentRoute.outputs.first?.portType
        let active = output.map(isBluetooth) == true ? "bluetooth" : output == .builtInSpeaker ? "speaker" : "earpiece"
        return ["available": available, "active": active, "labels": labels]
    }

    private func prepareCallAudio() throws {
        try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
        try audioSession.setActive(true)
    }

    private func applyAudioRoute(_ route: String) throws {
        try prepareCallAudio()
        if route == "speaker" {
            try audioSession.setPreferredInput(audioSession.availableInputs?.first(where: { $0.portType == .builtInMic }))
            try audioSession.overrideOutputAudioPort(.speaker)
        } else if route == "bluetooth" {
            guard let input = bluetoothInput() else { throw NSError(domain: "CdaDevice", code: 1, userInfo: [NSLocalizedDescriptionKey: "Connect a Bluetooth headset and try again."]) }
            try audioSession.overrideOutputAudioPort(.none)
            try audioSession.setPreferredInput(input)
        } else {
            try audioSession.setPreferredInput(audioSession.availableInputs?.first(where: { $0.portType == .builtInMic }))
            try audioSession.overrideOutputAudioPort(.none)
        }
    }

    @objc func beginCall(_ call: CAPPluginCall) {
        do {
            try prepareCallAudio()
            let route = call.getBool("speaker") == true ? "speaker" : "earpiece"
            try applyAudioRoute(route)
            call.resolve(routeResult())
        } catch { call.reject("Unable to configure call audio", nil, error) }
    }

    @objc func audioRoutes(_ call: CAPPluginCall) { call.resolve(routeResult()) }

    @objc func setAudioRoute(_ call: CAPPluginCall) {
        let route = call.getString("route") ?? "earpiece"
        guard ["earpiece", "speaker", "bluetooth"].contains(route) else { call.reject("Unknown audio route"); return }
        do { try applyAudioRoute(route); call.resolve(routeResult()) }
        catch { call.reject(error.localizedDescription, nil, error) }
    }

    @objc func endCall(_ call: CAPPluginCall) {
        do {
            try audioSession.overrideOutputAudioPort(.none)
            try audioSession.setPreferredInput(nil)
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
            call.resolve()
        } catch { call.reject("Unable to restore device audio", nil, error) }
    }

    @objc func startRingtone(_ call: CAPPluginCall) {
        ringtoneTimer?.invalidate()
        AudioServicesPlaySystemSound(1005)
        ringtoneTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in AudioServicesPlaySystemSound(1005) }
        call.resolve()
    }

    @objc func stopRingtone(_ call: CAPPluginCall) {
        ringtoneTimer?.invalidate()
        ringtoneTimer = nil
        AudioServicesDisposeSystemSoundID(1005)
        call.resolve()
    }
}
