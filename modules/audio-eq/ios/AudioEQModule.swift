import ExpoModulesCore

/**
 * Settings bridge for the player EQ.
 *
 * The filtered audio is produced by the audio tap that the app's expo-audio
 * patch installs on the AVPlayer. This module only stores the five band gains
 * and the enabled flag in UserDefaults, then nudges the player to re-read
 * them. The old implementation started a standalone AVAudioEngine with no
 * input, which is why the EQ was inaudible.
 */
public class AudioEQModule: Module {
  private static let bandCount = 5
  private static let enabledKey = "coda.eq.enabled"
  private static let gainKeyPrefix = "coda.eq.gain."
  private static let changedNotification = Notification.Name("CodaEQChanged")

  private static let bandFrequencies: [(index: Int, centerFreq: Float)] = [
    (0, 60),
    (1, 230),
    (2, 910),
    (3, 3600),
    (4, 14000),
  ]

  private var isEnabled = true
  private var bandGains: [Int: Double] = [:]

  public func definition() -> ModuleDefinition {
    Name("AudioEQ")

    AsyncFunction("initialize") { () -> Void in
      self.publish()
    }

    AsyncFunction("setBandGain") { (band: Int, gain: Double) -> Void in
      guard band >= 0 && band < AudioEQModule.bandCount else {
        return
      }
      let clamped = max(-12.0, min(12.0, gain))
      self.bandGains[band] = clamped
      self.publish()
    }

    AsyncFunction("getBandCount") { () -> Int in
      return AudioEQModule.bandCount
    }

    AsyncFunction("getBandInfo") { (band: Int) -> [String: Any] in
      guard band >= 0 && band < AudioEQModule.bandFrequencies.count else {
        return [:]
      }
      let info = AudioEQModule.bandFrequencies[band]
      return [
        "index": info.index,
        "centerFreq": info.centerFreq,
        "minGain": -12.0,
        "maxGain": 12.0,
      ]
    }

    AsyncFunction("setEnabled") { (enabled: Bool) -> Void in
      self.isEnabled = enabled
      self.publish()
    }

    AsyncFunction("teardown") { () -> Void in
      // The tap is owned by each player and is removed with it.
      self.publish()
    }

    OnDestroy {
      // Nothing to release: the player owns the processing tap.
    }
  }

  private func publish() {
    let defaults = UserDefaults.standard
    defaults.set(isEnabled, forKey: AudioEQModule.enabledKey)
    for band in 0..<AudioEQModule.bandCount {
      defaults.set(bandGains[band] ?? 0.0, forKey: "\(AudioEQModule.gainKeyPrefix)\(band)")
    }
    NotificationCenter.default.post(name: AudioEQModule.changedNotification, object: nil)
  }
}
