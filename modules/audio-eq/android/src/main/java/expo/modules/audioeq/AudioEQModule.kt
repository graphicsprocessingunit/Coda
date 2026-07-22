package expo.modules.audioeq

import android.media.audiofx.Equalizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AudioEQModule : Module() {
  private var equalizer: Equalizer? = null
  private var bandGains = mutableMapOf<Int, Short>()
  private var isEnabled = true

  override fun definition() = ModuleDefinition {
    Name("AudioEQ")

    AsyncFunction("initialize") {
      setupEqualizer()
    }

    AsyncFunction("setBandGain") { band: Int, gain: Double ->
      setGain(band, gain.toFloat())
    }

    AsyncFunction("getBandCount") {
      equalizer?.numberOfBands?.toInt() ?: 5
    }

    AsyncFunction("getBandInfo") { band: Int ->
      val eq = equalizer ?: return@AsyncFunction mapOf<String, Any>()
      if (band < 0 || band >= eq.numberOfBands) return@AsyncFunction mapOf<String, Any>()

      val freqRange = eq.bandFreqRange(band.toShort())
      val centerFreq = (freqRange[0] + freqRange[1]) / 2
      val minGain = eq.bandLevelRange[0].toDouble() / 100.0
      val maxGain = eq.bandLevelRange[1].toDouble() / 100.0

      mapOf(
        "index" to band,
        "centerFreq" to (centerFreq.toDouble() / 1000.0),
        "minGain" to minGain,
        "maxGain" to maxGain,
      )
    }

    AsyncFunction("setEnabled") { enabled: Boolean ->
      isEnabled = enabled
      equalizer?.enabled = enabled
    }

    AsyncFunction("teardown") {
      teardownEqualizer()
    }

    OnDestroy {
      teardownEqualizer()
    }
  }

  private fun setupEqualizer() {
    teardownEqualizer()
    try {
      val eq = Equalizer(0, 0)
      eq.enabled = isEnabled
      equalizer = eq
    } catch (e: Exception) {
      // Audio session not available yet
    }
  }

  private fun setGain(band: Int, gain: Float) {
    val clampedGain = (-12.0f).coerceAtLeast(gain.coerceAtMost(12.0f))
    bandGains[band] = (clampedGain * 100).toInt().toShort()
    equalizer?.setBandLevel(band.toShort(), bandGains[band] ?: 0)
  }

  private fun teardownEqualizer() {
    equalizer?.release()
    equalizer = null
  }
}
