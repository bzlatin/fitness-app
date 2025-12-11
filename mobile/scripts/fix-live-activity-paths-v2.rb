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

# Remove all existing LiveActivity references
puts "🗑️  Removing old references..."
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

# Add files - the files are physically in ios/pushpull/ folder
# and the pushpull_group's path in Xcode is set to that folder
# so we just need the filename
files_to_add = [
  'LiveActivityModule.swift',
  'LiveActivityModule.m'
]

puts "\n✨ Adding files with correct paths..."
files_to_add.each do |file_name|
  # The group's source_tree is already set to the pushpull folder
  # so we just need the filename
  file_ref = pushpull_group.new_reference(file_name)
  file_ref.source_tree = '<group>'

  # Add to build phase
  target.source_build_phase.add_file_reference(file_ref)
  puts "   ✅ #{file_name}"
end

# Save the project
project.save

puts "\n✅ Done! The files should now build correctly."
