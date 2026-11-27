# Razorpay Checkout (razorpay_flutter) — keep SDK classes and payment callbacks in release builds.
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** {*;}
-optimizations !method/inlining/
-keepclasseswithmembers class * {
  public void onPayment*(...);
}
# Optional Google Pay classes referenced by the SDK.
-dontwarn com.google.android.apps.nbu.paisa.inapp.client.api.**
