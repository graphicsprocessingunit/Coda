require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AudioEQ'
  s.version        = package['version']
  s.summary        = 'Native equalizer module for Coda'
  s.description    = '5-band parametric equalizer using AVAudioEngine'
  s.homepage       = 'https://github.com/graphicsprocessingunit/Coda'
  s.license        = 'UNLICENSED'
  s.author         = 'Graphicsprocessingunit'
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/graphicsprocessingunit/Coda.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = 'ios/**/*.{h,m,swift}'
end
