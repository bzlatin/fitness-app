#!/usr/bin/env ruby

require 'xcodeproj'

# Path to your .xcodeproj file
project_path = './ios/pushpull.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find both targets
main_target = project.targets.find { |t| t.name == 'pushpull' }
widget_target = project.targets.find { |t| t.name == 'WidgetsExtension' }

unless main_target
  puts "❌ Could not find 'pushpull' target"
  exit 1
end

unless widget_target
  puts "❌ Could not find 'WidgetsExtension' target"
  exit 1
end

# Use the pushpull group (since Widgets is a special sync group)
pushpull_group = project.main_group['pushpull']

unless pushpull_group
  puts "❌ Could not find 'pushpull' group"
  exit 1
end

# Remove existing references if any
file_name = 'WorkoutActivityAttributes.swift'
existing_refs = project.files.select { |f| f.path&.include?(file_name) }
existing_refs.each do |ref|
  puts "🗑️  Removing existing reference: #{ref.path}"
  ref.remove_from_project
end

main_target.source_build_phase.files.to_a.each do |build_file|
  if build_file.file_ref&.path&.include?(file_name)
    main_target.source_build_phase.files.delete(build_file)
  end
end

widget_target.source_build_phase.files.to_a.each do |build_file|
  if build_file.file_ref&.path&.include?(file_name)
    widget_target.source_build_phase.files.delete(build_file)
  end
end

# Add the file to the pushpull group
# The file is at ios/Widgets/WorkoutActivityAttributes.swift
# From ios/ folder perspective, it's Widgets/WorkoutActivityAttributes.swift
file_path = 'Widgets/WorkoutActivityAttributes.swift'
file_ref = pushpull_group.new_reference(file_path)
file_ref.source_tree = '<group>'

puts "\n✅ Added #{file_name} to project"
puts "   File reference path: #{file_ref.path}"

# Check if file exists
full_path = File.join(File.dirname(project_path), file_path)
puts "   Physical file path: #{full_path}"
puts "   File exists? #{File.exist?(full_path)}"

# Add to BOTH targets' build phases
main_target.source_build_phase.add_file_reference(file_ref)
puts "✅ Added to pushpull target"

widget_target.source_build_phase.add_file_reference(file_ref)
puts "✅ Added to WidgetsExtension target"

# Save the project
project.save

puts "\n✅ WorkoutActivityAttributes.swift is now available to both targets!"
puts "🔄 Rebuild the app"
