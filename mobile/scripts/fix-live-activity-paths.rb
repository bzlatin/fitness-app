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

# Remove incorrectly added files
['LiveActivityModule.swift', 'LiveActivityModule.m'].each do |file_name|
  # Find and remove from group
  file_ref = pushpull_group.files.find { |f| f.path&.include?(file_name) }
  if file_ref
    file_ref.remove_from_project
    puts "🗑️  Removed incorrect reference to #{file_name}"
  end

  # Remove from build phase
  target.source_build_phase.files.each do |build_file|
    if build_file.file_ref&.path&.include?(file_name)
      target.source_build_phase.files.delete(build_file)
      puts "🗑️  Removed #{file_name} from build phase"
    end
  end
end

# Add files with correct paths
files_to_add = [
  'LiveActivityModule.swift',
  'LiveActivityModule.m'
]

files_to_add.each do |file_name|
  # Add file reference with correct path (just the filename, it's in the same group folder)
  file_ref = pushpull_group.new_file(file_name)

  # Add to build phase
  target.source_build_phase.add_file_reference(file_ref)
  puts "✅ Added #{file_name} with correct path"
end

# Save the project
project.save

puts "✅ Live Activity module paths fixed"
puts "🔄 Rebuild the app"
