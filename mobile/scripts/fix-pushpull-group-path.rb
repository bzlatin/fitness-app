#!/usr/bin/env ruby

require 'xcodeproj'

# Path to your .xcodeproj file
project_path = './ios/pushpull.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Get the pushpull group
pushpull_group = project.main_group['pushpull']

unless pushpull_group
  puts "❌ Could not find 'pushpull' group"
  exit 1
end

puts "Current pushpull group settings:"
puts "  path: #{pushpull_group.path || 'nil'}"
puts "  source_tree: #{pushpull_group.source_tree}"
puts "  real_path: #{pushpull_group.real_path}"

# Set the path to 'pushpull' folder
puts "\n🔧 Setting pushpull group path to 'pushpull'..."
pushpull_group.path = 'pushpull'

puts "\nNew pushpull group settings:"
puts "  path: #{pushpull_group.path || 'nil'}"
puts "  source_tree: #{pushpull_group.source_tree}"
puts "  real_path: #{pushpull_group.real_path}"

# Save the project
project.save

puts "\n✅ pushpull group path fixed!"
puts "🔄 Now rebuild the app"
