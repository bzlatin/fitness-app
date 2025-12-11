#!/usr/bin/env ruby

# Script to add WidgetSyncModule files to Xcode project
# This modifies the project.pbxproj file to include the Swift and ObjC bridge files

require 'securerandom'

project_path = File.expand_path('../ios/pushpull.xcodeproj/project.pbxproj', __dir__)

unless File.exist?(project_path)
  puts "❌ Could not find project.pbxproj at #{project_path}"
  exit 1
end

puts "📝 Reading Xcode project file..."
content = File.read(project_path)

# Check if already added
if content.include?('WidgetSyncModule.swift')
  puts "✅ WidgetSyncModule.swift already in project"
  exit 0
end

# Generate UUIDs for the new files (Xcode uses 24-char hex IDs)
def generate_xcode_uuid
  SecureRandom.hex(12).upcase
end

swift_file_ref = generate_xcode_uuid
swift_build_ref = generate_xcode_uuid
objc_file_ref = generate_xcode_uuid
objc_build_ref = generate_xcode_uuid

puts "📦 Adding WidgetSyncModule files to Xcode project..."

# Find the PBXBuildFile section and add our build file entries
build_file_section = content[/\/\* Begin PBXBuildFile section \*\/(.*?)\/\* End PBXBuildFile section \*\//m, 1]
if build_file_section
  insert_after_build = content.index('/* End PBXBuildFile section */')
  content.insert(insert_after_build, "\t\t#{swift_build_ref} /* WidgetSyncModule.swift in Sources */ = {isa = PBXBuildFile; fileRef = #{swift_file_ref} /* WidgetSyncModule.swift */; };\n")
  content.insert(insert_after_build, "\t\t#{objc_build_ref} /* WidgetSyncModule.m in Sources */ = {isa = PBXBuildFile; fileRef = #{objc_file_ref} /* WidgetSyncModule.m */; };\n")
  puts "  ✓ Added to PBXBuildFile section"
end

# Find the PBXFileReference section and add our file references
file_ref_section_end = content.index('/* End PBXFileReference section */')
if file_ref_section_end
  content.insert(file_ref_section_end, "\t\t#{swift_file_ref} /* WidgetSyncModule.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = WidgetSyncModule.swift; path = pushpull/WidgetSyncModule.swift; sourceTree = \"<group>\"; };\n")
  content.insert(file_ref_section_end, "\t\t#{objc_file_ref} /* WidgetSyncModule.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; name = WidgetSyncModule.m; path = pushpull/WidgetSyncModule.m; sourceTree = \"<group>\"; };\n")
  puts "  ✓ Added to PBXFileReference section"
end

# Find where AppDelegate.swift is in the group and add our files nearby
appdelegate_match = content.match(/F11748412D0307B40044C1D9 \/\* AppDelegate\.swift \*\/,/)
if appdelegate_match
  insert_pos = content.index(appdelegate_match[0]) + appdelegate_match[0].length
  content.insert(insert_pos, "\n\t\t\t\t#{swift_file_ref} /* WidgetSyncModule.swift */,")
  content.insert(insert_pos, "\n\t\t\t\t#{objc_file_ref} /* WidgetSyncModule.m */,")
  puts "  ✓ Added to pushpull group (file list)"
end

# Find the PBXSourcesBuildPhase section and add our files to the build
sources_match = content.match(/(F11748422D0307B40044C1D9 \/\* AppDelegate\.swift in Sources \*\/,)/)
if sources_match
  insert_pos = content.index(sources_match[0]) + sources_match[0].length
  content.insert(insert_pos, "\n\t\t\t\t#{swift_build_ref} /* WidgetSyncModule.swift in Sources */,")
  content.insert(insert_pos, "\n\t\t\t\t#{objc_build_ref} /* WidgetSyncModule.m in Sources */,")
  puts "  ✓ Added to Sources build phase"
end

# Write the modified project file
File.write(project_path, content)

puts "✅ Successfully added WidgetSyncModule files to Xcode project!"
puts "📱 You can now rebuild the app:"
puts "   cd /Users/ben/coding_projects/fitness-app/mobile && npm run ios"
