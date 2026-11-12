const { withInfoPlist, withAppDelegate } = require('@expo/config-plugins');

const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const FACTORY_PROP = 'var reactNativeFactory: RCTReactNativeFactory?';

const SCENE_DELEGATE = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
      _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
    } else if let activity = connectionOptions.userActivities.first(where: {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }), let url = activity.webpageURL {
      launchOptions[.url] = url
      _ = appDelegate.application(
        UIApplication.shared,
        continue: activity,
        restorationHandler: { _ in })
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions.isEmpty ? nil : launchOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

function patchAppDelegate(contents) {
  if (contents.includes('class SceneDelegate')) {
    return contents;
  }

  if (!contents.includes(WINDOW_BLOCK)) {
    throw new Error(
      'withSceneLifecycle: unexpected AppDelegate template (window block not found).'
    );
  }

  let next = contents.replace(WINDOW_BLOCK, 'self.launchOptions = launchOptions');

  if (!next.includes('var launchOptions: [UIApplication.LaunchOptionsKey: Any]?')) {
    if (!next.includes(FACTORY_PROP)) {
      throw new Error(
        'withSceneLifecycle: unexpected AppDelegate template (reactNativeFactory property not found).'
      );
    }
    next = next.replace(
      FACTORY_PROP,
      `${FACTORY_PROP}

  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?`
    );
  }

  return `${next}\n${SCENE_DELEGATE}`;
}

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });

  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate.');
    }
    config.modResults.contents = patchAppDelegate(config.modResults.contents);
    return config;
  });
};
