use std::sync::mpsc;

// ── macOS: UNUserNotificationCenter ──

#[cfg(target_os = "macos")]
fn is_bundled() -> bool {
    use objc2_foundation::NSBundle;
    NSBundle::mainBundle().bundleIdentifier().is_some()
}

/// Set up a UNUserNotificationCenterDelegate so macOS shows banner
/// notifications even when the app is in the foreground.
#[cfg(target_os = "macos")]
pub fn setup_delegate() {
    if !is_bundled() {
        return;
    }

    use block2::DynBlock;
    use objc2::rc::Retained;
    use objc2::{define_class, msg_send, AnyThread};
    use objc2_foundation::{NSObject, NSObjectProtocol};
    use objc2_user_notifications::{
        UNNotification, UNNotificationPresentationOptions, UNUserNotificationCenter,
        UNUserNotificationCenterDelegate,
    };
    use std::sync::OnceLock;

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "CCNotifDelegate"]
        struct CCDelegate;

        impl CCDelegate {
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                handler: &DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                let opts = UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::Sound
                    | UNNotificationPresentationOptions::List;
                handler.call((opts,));
            }
        }

        unsafe impl NSObjectProtocol for CCDelegate {}
        unsafe impl UNUserNotificationCenterDelegate for CCDelegate {}
    );

    impl CCDelegate {
        fn new_instance() -> Retained<Self> {
            let this = Self::alloc().set_ivars(());
            unsafe { msg_send![super(this), init] }
        }
    }

    static DELEGATE: OnceLock<Retained<CCDelegate>> = OnceLock::new();
    let delegate = DELEGATE.get_or_init(CCDelegate::new_instance);

    let center = UNUserNotificationCenter::currentNotificationCenter();
    unsafe {
        let _: () = msg_send![&center, setDelegate: &**delegate];
    };
}

#[cfg(not(target_os = "macos"))]
pub fn setup_delegate() {}

#[cfg(target_os = "macos")]
pub fn request_permission() -> Result<bool, String> {
    if !is_bundled() {
        return Err("App is not bundled - notifications require a .app bundle".into());
    }

    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::NSError;
    use objc2_user_notifications::{UNAuthorizationOptions, UNUserNotificationCenter};
    use std::time::Duration;

    let (tx, rx) = mpsc::channel();
    let options = UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound;

    let handler = RcBlock::new(move |granted: Bool, error: *mut NSError| {
        let granted_bool = granted.as_bool();
        if !error.is_null() {
            let desc = unsafe { &*error }.localizedDescription();
            eprintln!("[notifications] authorization error: {desc}");
        }
        let _ = tx.send(granted_bool);
    });

    let center = UNUserNotificationCenter::currentNotificationCenter();
    center.requestAuthorizationWithOptions_completionHandler(options, &handler);

    rx.recv_timeout(Duration::from_secs(30))
        .map_err(|e| format!("Permission request timed out: {e}"))
}

#[cfg(target_os = "macos")]
pub fn check_permission() -> Result<String, String> {
    if !is_bundled() {
        return Ok("not-determined".to_string());
    }

    use block2::RcBlock;
    use objc2_user_notifications::{
        UNAuthorizationStatus, UNNotificationSettings, UNUserNotificationCenter,
    };
    use std::ptr::NonNull;

    let (tx, rx) = mpsc::channel();

    let handler = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
        let status = unsafe { settings.as_ref() }.authorizationStatus();
        let s = match status {
            UNAuthorizationStatus::NotDetermined => "not-determined",
            UNAuthorizationStatus::Denied => "denied",
            UNAuthorizationStatus::Authorized => "granted",
            UNAuthorizationStatus::Provisional => "provisional",
            UNAuthorizationStatus::Ephemeral => "ephemeral",
            _ => "unknown",
        };
        let _ = tx.send(s.to_string());
    });

    let center = UNUserNotificationCenter::currentNotificationCenter();
    center.getNotificationSettingsWithCompletionHandler(&handler);

    rx.recv().map_err(|e| format!("Channel error: {e}"))
}

#[cfg(target_os = "macos")]
pub fn send(title: &str, body: &str, sound: Option<&str>) -> Result<(), String> {
    if !is_bundled() {
        return Err("App is not bundled - notifications require a .app bundle".into());
    }

    use block2::RcBlock;
    use objc2_foundation::{NSError, NSString};
    use objc2_user_notifications::{
        UNMutableNotificationContent, UNNotificationRequest, UNNotificationSound,
        UNUserNotificationCenter,
    };

    let (tx, rx) = mpsc::channel();

    let content = UNMutableNotificationContent::new();
    content.setTitle(&NSString::from_str(title));
    content.setBody(&NSString::from_str(body));

    match sound {
        Some(s) if s == "none" => {}
        Some(s) if s == "default" || s.is_empty() => {
            content.setSound(Some(&UNNotificationSound::defaultSound()));
        }
        Some(s) => {
            content.setSound(Some(&UNNotificationSound::soundNamed(&NSString::from_str(s))));
        }
        None => {
            content.setSound(Some(&UNNotificationSound::defaultSound()));
        }
    }

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let id = NSString::from_str(&format!("cc-{ts}"));

    let request =
        UNNotificationRequest::requestWithIdentifier_content_trigger(&id, &content, None);

    let center = UNUserNotificationCenter::currentNotificationCenter();

    let handler = RcBlock::new(move |error: *mut NSError| {
        if error.is_null() {
            let _ = tx.send(Ok(()));
        } else {
            let _ = tx.send(Err("Failed to deliver notification".to_string()));
        }
    });

    center.addNotificationRequest_withCompletionHandler(&request, Some(&handler));

    rx.recv().map_err(|e| format!("Channel error: {e}"))?
}

#[cfg(target_os = "macos")]
pub fn open_settings() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.Notifications-Settings.extension")
        .spawn()
        .map_err(|e| format!("Failed to open notification settings: {e}"))?;
    Ok(())
}

// ── Windows / Linux: notify-rust ──

#[cfg(not(target_os = "macos"))]
pub fn request_permission() -> Result<bool, String> {
    Ok(true)
}

#[cfg(not(target_os = "macos"))]
pub fn check_permission() -> Result<String, String> {
    Ok("granted".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn open_settings() -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn send(title: &str, body: &str, sound: Option<&str>) -> Result<(), String> {
    let mut n = notify_rust::Notification::new();
    n.summary(title).body(body);
    match sound {
        Some(s) if s != "none" => {
            n.sound_name(s);
        }
        None => {
            n.sound_name("default");
        }
        _ => {}
    }
    n.show().map_err(|e| e.to_string())?;
    Ok(())
}
