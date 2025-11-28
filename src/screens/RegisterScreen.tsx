import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';

const RegisterScreen = ({ navigation }: { navigation: any }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      Alert.alert('Success', 'Registered successfully. Please login.');
      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gradient-to-tr from-indigo-900 via-purple-900 to-pink-900"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-8 py-12">
          <Text className="text-4xl font-extrabold text-white mb-12 text-center drop-shadow-lg">
            Create Account
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#ccc"
            autoCapitalize="none"
            className="bg-white bg-opacity-20 rounded-xl px-5 py-4 mb-6 text-white placeholder-gray-300 font-semibold"
            style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 }}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#ccc"
            keyboardType="email-address"
            autoCapitalize="none"
            className="bg-white bg-opacity-20 rounded-xl px-5 py-4 mb-6 text-white placeholder-gray-300 font-semibold"
            style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#ccc"
            secureTextEntry
            className="bg-white bg-opacity-20 rounded-xl px-5 py-4 mb-10 text-white placeholder-gray-300 font-semibold"
            style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 }}
          />

          <TouchableOpacity
            disabled={loading}
            onPress={handleRegister}
            activeOpacity={0.8}
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 rounded-xl py-4"
            style={loading ? { opacity: 0.7 } : undefined}
          >
            <Text className="text-center text-white font-bold text-lg">{loading ? 'Registering...' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <View className="mt-8 flex-row justify-center">
            <Text className="text-white text-opacity-70 mr-2 font-medium">Already have an account?</Text>
            <Text
              onPress={() => navigation.navigate('Login')}
              className="text-white font-extrabold underline text-opacity-90"
            >
              Login
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;
