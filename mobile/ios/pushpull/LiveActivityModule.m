//
//  LiveActivityModule.m
//  pushpull
//
//  React Native bridge for LiveActivityModule
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityModule, NSObject)

RCT_EXTERN_METHOD(startWorkoutActivity:(NSDictionary *)params)
RCT_EXTERN_METHOD(updateWorkoutActivity:(NSDictionary *)params)
RCT_EXTERN_METHOD(endWorkoutActivity)
RCT_EXTERN_METHOD(endWorkoutActivityForSession:(NSString *)sessionId)
RCT_EXTERN_METHOD(endWorkoutActivityWithSummary:(NSDictionary *)params)
RCT_EXTERN_METHOD(areLiveActivitiesEnabled:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(scheduleTimerCompleteSound:(NSString *)sessionId timestampMs:(nonnull NSNumber *)timestampMs resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancelScheduledTimerSound)

@end
