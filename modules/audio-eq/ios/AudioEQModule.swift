import ExpoModulesCore
import AVFoundation

public class AudioEQModule: Module {
  private var audioEngine: AVAudioEngine?
  private var eqNode: AVAudioUnitEQ?
  private var bandGains: [Int: Float] = [:]
  private var isEnabled: Bool = true

  private static let bandFrequencies: [(index: Int, centerFreq: Float)] = [
    (0, 60),
    (1, 230),
    (2, 910),
    (3, 3600),
    (4, 14000),
  ]

  public func definition() -> ModuleDefinition {
    Name("AudioEQ")

    AsyncFunction("initialize") { () -> Void in
      self.setupEngine()
    }

    AsyncFunction("setBandGain") { (band: Int, gain: Double) -> Void in
      self.setGain(band: band, gain: Float(gain))
    }

    AsyncFunction("getBandCount") { () -> Int in
      return AudioEQModule.bandFrequencies.count
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
      self.eqNode?.bypass = !enabled
    }

    AsyncFunction("teardown") { () -> Void in
      self.teardownEngine()
    }

    OnDestroy {
      self.teardownEngine()
    }
  }

  private func setupEngine() {
    teardownEngine()

    let engine = AVAudioEngine()
    let eq = AVAudioUnitEQ(numberOfBands: AudioEQModule.bandFrequencies.count)

    for bandInfo in AudioEQModule.bandFrequencies {
      let band = eq.bands[bandInfo.index]
      band.filterType = .parametric
      band.frequency = bandInfo.centerFreq
      band.bandwidth = 1.0
      band.gain = bandGains[bandInfo.index] ?? 0.0
      band.bypass = false
    }

    engine.attach(eq)
    engine.connect(eq, to: engine.mainMixerNode, format: nil)

    do {
      try engine.start()
      self.audioEngine = engine
      self.eqNode = eq
    } catch {
      print("AudioEQ: Failed to start engine: \(error)")
    }
  }

  private func setGain(band: Int, gain: Float) {
    bandGains[band] = gain
    let clampedGain = max(-12.0, min(12.0, gain))
    guard let eq = eqNode, band >= 0 && band < eq.bands.count else { return }
    eq.bands[band].gain = clampedGain
  }

  private func teardownEngine() {
    audioEngine?.stop()
    if let eq = eqNode {
      audioEngine?.detach(eq)
    }
    audioEngine = nil
    eqNode = nil
  }
}
