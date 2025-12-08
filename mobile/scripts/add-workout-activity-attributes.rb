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

# Find or create the Widgets group
widgets_group = project.main_group['Widgets']
unless widgets_group
  puts "Creating Widgets group..."
  widgets_group = project.main_group.new_group('Widgets', 'Widgets')
end

puts "Widgets group path: #{widgets_group.path || 'nil'}"
# Skip real_path for special group types

# Remove existing references if any
file_name = 'WorkoutActivityAttributes.swift'
existing_refs = project.files.select { |f| f.path&.include?(file_name) }
existing_refs.each do |ref|
  puts "Removing existing reference: #{ref.path}"
  ref.remove_from_project
end

# Add the file to the Widgets group
# The file is at ios/Widgets/WorkoutActivityAttributes.swift
file_ref = widgets_group.new_reference(file_name)
file_ref.source_tree = '<group>'

puts "\n✅ Added #{file_name} to Widgets group"
puts "   File reference path: #{file_ref.path}"
puts "   File real path: #{file_ref.real_path}"
puts "   File exists? #{File.exist?(file_ref.real_path)}"

# Add to BOTH targets' build phases
main_target.source_build_phase.add_file_reference(file_ref)
puts "✅ Added to pushpull target"

widget_target.source_build_phase.add_file_reference(file_ref)
puts "✅ Added to WidgetsExtension target"

# Save the project
project.save

puts "\n✅ WorkoutActivityAttributes.swift is now available to both targets!"
puts "🔄 Rebuild the app"
