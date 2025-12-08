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

# Get the pushpull group
pushpull_group = project.main_group['pushpull']

unless pushpull_group
  puts "❌ Could not find 'pushpull' group"
  exit 1
end

# First, revert the pushpull group path to nil (the default)
puts "🔧 Reverting pushpull group path to default..."
pushpull_group.path = nil

# Remove all existing LiveActivity references
puts "🗑️  Removing old LiveActivity references..."
target.source_build_phase.files.to_a.each do |build_file|
  if build_file.file_ref&.path&.include?('LiveActivity')
    target.source_build_phase.files.delete(build_file)
    puts "   Removed #{build_file.file_ref.path} from build phase"
  end
end

pushpull_group.files.to_a.each do |file_ref|
  if file_ref.path&.include?('LiveActivity')
    file_ref.remove_from_project
    puts "   Removed #{file_ref.path} from group"
  end
end

# Now add the LiveActivity files with the correct approach
# We need to check how other Swift files like AppDelegate.swift are referenced
puts "\n🔍 Checking how existing Swift files are referenced..."
app_delegate = pushpull_group.files.find { |f| f.path == 'AppDelegate.swift' }
if app_delegate
  puts "   AppDelegate.swift path: #{app_delegate.path}"
  puts "   AppDelegate.swift real_path: #{app_delegate.real_path}"
end

# Add the files the same way as AppDelegate.swift
files_to_add = [
  'LiveActivityModule.swift',
  'LiveActivityModule.m'
]

puts "\n✨ Adding LiveActivity files..."
files_to_add.each do |file_name|
  # Create a new file reference in the pushpull group
  # The path should be relative to the group's location
  # Since pushpull group has no path, and files are in ios/pushpull/
  # we need to specify 'pushpull/FILENAME'
  file_ref = pushpull_group.new_reference("pushpull/#{file_name}")
  file_ref.source_tree = '<group>'

  # Add to build phase
  target.source_build_phase.add_file_reference(file_ref)
  puts "   ✅ #{file_name} (path: pushpull/#{file_name})"
end

# Save the project
project.save

puts "\n✅ Done! Files added with correct paths."
puts "🔄 Try building again"
