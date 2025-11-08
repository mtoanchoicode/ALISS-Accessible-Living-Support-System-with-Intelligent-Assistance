import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// 1. Import your AuthGate file
// Make sure the path is correct based on your folder structure
import 'features/auth/services/auth_gate.dart';

Future<void> main() async {
  // 2. You MUST ensure Flutter is initialized
  WidgetsFlutterBinding.ensureInitialized();

  // 3. Initialize Supabase
  // TODO: Replace with your own Supabase URL and Anon Key
  await Supabase.initialize(
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  );

  // 4. Run the app
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aliss', // You can change this
      theme: ThemeData(
        primarySwatch: Colors.blue,
        // You can add other theme settings here
      ),
      // 5. Set the AuthGate as the home widget
      // This is the file that will handle all auth navigation
      home: const AuthGate(),
    );
  }
}
