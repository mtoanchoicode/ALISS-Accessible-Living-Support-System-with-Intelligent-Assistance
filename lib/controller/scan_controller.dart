// scan_controller.dart (UPDATED)
import 'package:camera/camera.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';

class ScanController extends GetxController {
  late CameraController cameraController;
  late List<CameraDescription> cameras;

  var isCameraInitialized = false.obs;


  @override
  void onClose() {
    if (isCameraInitialized.value) {
      cameraController.dispose();
    }
    super.onClose();
  }

  // initCamera will now be triggered by the button press
  Future<void> initCamera() async {
    if (await Permission.camera.request().isGranted) {
      cameras = await availableCameras();
      cameraController = CameraController(cameras[0], ResolutionPreset.max);
      await cameraController.initialize();
      isCameraInitialized(true);
      update();
    } else {
      print("Permission not granted");
      // Optional: show a user-friendly dialog here
    }
  }

  Future<void> captureAndSaveImage() async {
    if (!isCameraInitialized.value) {
      print("Camera is not initialized yet.");
      return;
    }

    try {
      // 1. Capture the image using the camera controller
      final XFile file = await cameraController.takePicture();

      // 2. The XFile contains the temporary path where the image is stored
      print("Image captured successfully to: ${file.path}");

      // OPTIONAL: If you were building a production desktop app,
      // you would use the 'path_provider' and 'dart:io' packages
      // here to move 'file.path' to a permanent, user-accessible directory
      // (like the 'Pictures' folder).

      // For development, just knowing the path is often enough for confirmation.
      Get.snackbar(
        "Success",
        "Photo saved to temporary path: ${file.path}",
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (e) {
      print("Error capturing image: $e");
      Get.snackbar("Error", "Failed to capture photo: $e");
    }
  }
}
