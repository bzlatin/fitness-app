#!/usr/bin/env ruby

require 'xcodeproj'

# Path to your .xcodeproj file
project_path = './ios/pushpull.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main app target
target = project.targets.find { |t| t.name == 'pushpull' }

unless target
  puts "❌ Could not find 'pushpull' target"
  exit 1
end

# Files to add
files_to_add = [
  'pushpull/LiveActivityModule.swift',
  'pushpull/LiveActivityModule.m'
]

# Get the pushpull group
pushpull_group = project.main_group['pushpull']

unless pushpull_group
  puts "❌ Could not find 'pushpull' group"
  exit 1
end

files_to_add.each do |file_path|
  file_name = File.basename(file_path)

  # Check if file already exists in project
  existing_file = pushpull_group.files.find { |f| f.path == file_name }

  if existing_file
    puts "⚠️  #{file_name} already exists in project, skipping..."
    next
  end

  # Add file reference
  file_ref = pushpull_group.new_file("../#{file_path}")

  # Add to build phase (only .swift and .m files)
  if file_name.end_with?('.swift', '.m')
    target.source_build_phase.add_file_reference(file_ref)
    puts "✅ Added #{file_name} to build phase"
  end
end

# Save the project
project.save

puts "✅ Live Activity module files added to Xcode project"
puts "🔄 Run 'pod install' and rebuild the app"
