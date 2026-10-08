const { withAppDelegate, withInfoPlist, withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// iOS 27 asserts at launch unless the app adopts the UIScene life cycle
// (crash signature: ___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
// Expo SDK 57 ships the supporting `ExpoAppSceneDelegate` base class (see
// node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift), but the
// `expo-template-bare-minimum@57.x` template `npx expo prebuild` generates from
// hasn't been updated to wire it in yet (confirmed against the published 57.0.29
// template and expo/expo's own "SDK <= 57 templates" test fixture comment). The
// fix below mirrors what expo/expo's own `main` branch template already does for
// the next SDK, applied here as a config plugin so it survives `expo prebuild --clean`
// instead of hand-editing the generated ios/ directory.

const SCENE_DELEGATE_CONTENTS = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

const LEGACY_WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

`;

const LEGACY_CLASS_DECLARATION = 'class AppDelegate: ExpoAppDelegate {';
const SCENE_CLASS_DECLARATION = 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';

function getProjectName(projectRoot) {
  return path.basename(IOSConfig.Paths.getSourceRoot(projectRoot));
}

function withSceneDelegateFile(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const sourceRoot = IOSConfig.Paths.getSourceRoot(config.modRequest.projectRoot);
      fs.writeFileSync(path.join(sourceRoot, 'SceneDelegate.swift'), SCENE_DELEGATE_CONTENTS);
      return config;
    },
  ]);
}

function withSceneDelegateXcodeProject(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = getProjectName(config.modRequest.projectRoot);
    const relativeFilePath = `${projectName}/SceneDelegate.swift`;
    if (!project.hasFile(relativeFilePath)) {
      const groupKey = project.findPBXGroupKey({ name: projectName });
      if (!groupKey) {
        throw new Error(
          `withIOSSceneLifecycle: could not find the "${projectName}" PBXGroup to attach SceneDelegate.swift to.`
        );
      }
      project.addSourceFile(relativeFilePath, {}, groupKey);
    }
    return config;
  });
}

function withAppDelegateSceneLifecycle(config) {
  return withAppDelegate(config, (config) => {
    const { contents, language } = config.modResults;
    if (language !== 'swift') {
      throw new Error(
        `withIOSSceneLifecycle expects a Swift AppDelegate, got "${language}". ` +
          'Update this plugin before relying on it for an Objective-C project.'
      );
    }
    let next = contents;
    let patchedWindowBlock = false;
    let patchedConformance = false;

    if (next.includes(LEGACY_WINDOW_BLOCK)) {
      next = next.replace(LEGACY_WINDOW_BLOCK, '');
      patchedWindowBlock = true;
    }
    if (next.includes(LEGACY_CLASS_DECLARATION)) {
      next = next.replace(LEGACY_CLASS_DECLARATION, SCENE_CLASS_DECLARATION);
      patchedConformance = true;
    }

    const alreadyMigrated = next.includes('ExpoReactNativeFactoryProvider') && !patchedConformance;
    if (!patchedWindowBlock && !patchedConformance && !alreadyMigrated) {
      // The template AppDelegate.swift we expect to patch has changed shape.
      // Fail loudly instead of silently leaving the pre-iOS-27 crash in place.
      throw new Error(
        'withIOSSceneLifecycle: could not find the expected legacy UIWindow/startReactNative block ' +
          'or "class AppDelegate: ExpoAppDelegate {" declaration in AppDelegate.swift to patch. The ' +
          'expo-template-bare-minimum AppDelegate.swift template has likely changed — re-check against ' +
          'node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift and update this plugin.'
      );
    }

    config.modResults.contents = next;
    return config;
  });
}

function withInfoPlistSceneManifest(config) {
  return withInfoPlist(config, (config) => {
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
}

module.exports = function withIOSSceneLifecycle(config) {
  config = withSceneDelegateFile(config);
  config = withSceneDelegateXcodeProject(config);
  config = withAppDelegateSceneLifecycle(config);
  config = withInfoPlistSceneManifest(config);
  return config;
};
