//
//  WidgetSyncModule.m
//  pushpull
//
//  Objective-C bridge for WidgetSyncModule Swift class
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetSyncModule, NSObject)

RCT_EXTERN_METHOD(syncWidgetData:(NSDictionary *)data)
RCT_EXTERN_METHOD(clearWidgetData)
RCT_EXTERN_METHOD(refreshWidgets)
RCT_EXTERN_METHOD(writeToAppGroup:(NSString *)key value:(id)value)
RCT_EXTERN_METHOD(readFromAppGroup:(NSString *)key callback:(RCTResponseSenderBlock)callback)

@end
