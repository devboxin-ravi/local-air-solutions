/// Profile picture: choose / take / remove, crop to a circle, then upload.
/// Used by customer and technician profiles.
library;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/themes/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import 'auth_provider.dart';

enum _AvatarAction { camera, gallery, remove }

/// Opens the profile-picture sheet and applies the user's choice.
Future<void> changeAvatar(BuildContext context, WidgetRef ref) async {
  final hasPhoto = ref.read(avatarProvider).value != null;
  final action = await showModalBottomSheet<_AvatarAction>(
    context: context,
    builder: (c) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.fromLTRB(Space.page, 0, Space.page, Space.sm), child: Text('Profile picture', style: Theme.of(c).textTheme.titleLarge)),
        ListTile(leading: const IconBox(Icons.photo_camera_outlined, size: 40), title: const Text('Take a photo', style: TextStyle(fontWeight: FontWeight.w700)), onTap: () => Navigator.pop(c, _AvatarAction.camera)),
        ListTile(
          leading: const IconBox(Icons.photo_library_outlined, size: 40, color: AppColors.greenDark, background: AppColors.greenSoft),
          title: const Text('Choose from gallery', style: TextStyle(fontWeight: FontWeight.w700)),
          onTap: () => Navigator.pop(c, _AvatarAction.gallery),
        ),
        if (hasPhoto)
          ListTile(
            leading: const IconBox(Icons.delete_outline_rounded, size: 40, color: AppColors.red, background: AppColors.redSoft),
            title: const Text('Remove photo', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.red)),
            onTap: () => Navigator.pop(c, _AvatarAction.remove),
          ),
        const SizedBox(height: Space.md),
      ]),
    ),
  );
  if (action == null || !context.mounted) return;

  final repo = ref.read(authRepositoryProvider);
  try {
    if (action == _AvatarAction.remove) {
      await repo.removeAvatar();
      ref.invalidate(avatarProvider);
      if (context.mounted) showAppSnack(context, 'Profile picture removed');
      return;
    }
    // Pick at a generous size so the crop still has detail; the crop step does the final resize.
    final file = await ImagePicker().pickImage(
      source: action == _AvatarAction.camera ? ImageSource.camera : ImageSource.gallery,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 95,
      maxWidth: Limits.imageMaxWidth,
      maxHeight: Limits.imageMaxWidth,
    );
    if (file == null) return;
    final path = await _crop(file.path);
    if (path == null) return; // cropping cancelled
    await repo.uploadAvatar(path);
    ref.invalidate(avatarProvider);
    if (context.mounted) showAppSnack(context, 'Profile picture updated');
  } on ApiException catch (e) {
    if (context.mounted) showAppSnack(context, e.message, error: true);
  }
}

/// Square crop with a round preview (move, pinch to zoom, rotate). Returns the cropped file's
/// path, or null when the user cancels. On web (preview builds only) the photo is used as picked.
Future<String?> _crop(String sourcePath) async {
  if (kIsWeb) return sourcePath;
  final size = Limits.avatarMaxWidth.toInt();
  final cropped = await ImageCropper().cropImage(
    sourcePath: sourcePath,
    aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
    maxWidth: size,
    maxHeight: size,
    compressFormat: ImageCompressFormat.jpg,
    compressQuality: Limits.avatarQuality,
    uiSettings: [
      AndroidUiSettings(
        toolbarTitle: 'Crop photo',
        toolbarColor: AppColors.blue,
        statusBarLight: false,
        toolbarWidgetColor: Colors.white,
        activeControlsWidgetColor: AppColors.green,
        backgroundColor: AppColors.navy,
        cropStyle: CropStyle.circle,
        lockAspectRatio: true,
        hideBottomControls: false,
        showCropGrid: false,
      ),
      IOSUiSettings(
        title: 'Crop photo',
        doneButtonTitle: 'Use photo',
        cancelButtonTitle: 'Cancel',
        cropStyle: CropStyle.circle,
        aspectRatioLockEnabled: true,
        resetAspectRatioEnabled: false,
      ),
    ],
  );
  return cropped?.path;
}
