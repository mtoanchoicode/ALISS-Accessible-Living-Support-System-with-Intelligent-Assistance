// camera_view.dart (WITH CAPTURE BUTTON)
import 'package:aliss/controller/scan_controller.dart';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

class CameraView extends StatelessWidget {
  const CameraView({super.key});

  @override
  Widget build(BuildContext context) {
    return GetBuilder<ScanController>(
      init: ScanController(),
      builder: (controller) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('Live Camera'),
            backgroundColor: Colors.blueGrey,
          ),
          body: Center(
            child: Obx(() {
              if (controller.isCameraInitialized.value) {
                // When camera is initialized, show the live feed
                return CameraPreview(controller.cameraController);
              } else {
                // When not initialized, show the 'Open Camera' button
                return ElevatedButton.icon(
                  icon: const Icon(Icons.camera_alt),
                  label: const Text(
                    "OPEN CAMERA",
                    style: TextStyle(fontSize: 18),
                  ),
                  onPressed: () => controller.initCamera(),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 40,
                      vertical: 20,
                    ),
                  ),
                );
              }
            }),
          ),

          // NEW: Capture Button
          floatingActionButton: Obx(() {
            return controller.isCameraInitialized.value
                ? FloatingActionButton(
                    onPressed: () => controller
                        .captureAndSaveImage(), // <-- Call the new function
                    child: const Icon(Icons.camera),
                  )
                : const SizedBox(); // Hide the button if camera isn't open
          }),
          floatingActionButtonLocation:
              FloatingActionButtonLocation.centerFloat,
        );
      },
    );
  }
}
