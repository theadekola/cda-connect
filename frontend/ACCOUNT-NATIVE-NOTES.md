Native account-data export

Run npm install and npx cap sync in frontend before rebuilding existing Android/iOS projects. Account exports use the Filesystem cache directory and the native Share sheet. No broad device-storage permission is requested.

For iOS, merge the FileTimestamp / C617.1 entry in frontend/PrivacyInfo.xcprivacy into ios/App/PrivacyInfo.xcprivacy and include that file in the app target in Xcode. Preserve any other existing privacy-manifest entries. This repository currently has no generated iOS/Android projects, so native exports require a device build and verification.

References: https://capacitorjs.com/docs/apis/filesystem and https://capacitorjs.com/docs/apis/share
