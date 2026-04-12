//
//  AppViewController.swift
//  App
//
//  Created by Jonas on 09/04/2026.
//
import UIKit
import Capacitor

class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ReviewPromptPlugin())
    }
}
