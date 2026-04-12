import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(ReviewPromptPlugin)
public class ReviewPromptPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReviewPromptPlugin"
    public let jsName = "ReviewPrompt"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) {
                if let scene = UIApplication.shared.connectedScenes
                    .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                    SKStoreReviewController.requestReview(in: scene)
                    call.resolve()
                    return
                }
            }

            SKStoreReviewController.requestReview()
            call.resolve()
        }
    }
}