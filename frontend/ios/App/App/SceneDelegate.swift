import UIKit
import Capacitor

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
        CAPPluginMethod(name: "pushConfiguration", returnType: CAPPluginReturnPromise)
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
}
