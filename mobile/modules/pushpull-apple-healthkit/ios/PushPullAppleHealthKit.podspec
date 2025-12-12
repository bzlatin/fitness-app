require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'PushPullAppleHealthKit'
  s.module_name    = 'PushPullAppleHealthKit'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { type: 'UNLICENSED' }
  s.author         = { 'PushPull' => 'dev@pushpull.local' }
  s.homepage       = 'https://example.invalid'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { path: '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # NOTE: This podspec lives in `ios/`, so source globs are relative to this folder.
  # Use a broad glob so the Swift module is actually compiled and importable.
  s.source_files = '**/*.{h,m,swift}'
end
