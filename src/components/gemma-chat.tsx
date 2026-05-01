import React, { useState, useRef } from 'react';
import { View, TextInput, Button, FlatList, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGemmaModel } from '@/hooks/useGemmaModel';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

export default function GemmaChat() {
  const { model, isReady, downloadProgress, error, backend } = useGemmaModel();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const sendingRef = useRef(false);

  const send = async () => {
    if (!model || sendingRef.current || !input.trim()) return;
    const userText = input.trim();
    setInput('');

    const userMsg: Message = { id: `${Date.now()}-u`, role: 'user', text: userText };
    const assistantMsg: Message = { id: `${Date.now()}-a`, role: 'assistant', text: '' };

    setMessages((m) => [...m, userMsg, assistantMsg]);
    sendingRef.current = true;

    try {
      // Try streaming if available
      if (typeof model.sendMessageAsync === 'function') {
        let done = false;
        await model.sendMessageAsync(userText, (token: string, isDone: boolean) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsg.id ? { ...msg, text: msg.text + token } : msg)),
          );
          if (isDone) done = true;
        });
        // ensure done
        if (!done) {
          // nothing
        }
      } else {
        const resp = await model.sendMessage(userText);
        setMessages((prev) => prev.map((msg) => (msg.id === assistantMsg.id ? { ...msg, text: resp } : msg)));
      }
    } catch (e) {
      setMessages((prev) => prev.map((msg) => (msg.id === assistantMsg.id ? { ...msg, text: `Error: ${String(e)}` } : msg)));
    } finally {
      sendingRef.current = false;
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="small">Backend: {backend}</ThemedText>
        <ThemedText type="small">{isReady ? 'Ready' : `Loading ${Math.round((downloadProgress || 0) * 100)}%`}</ThemedText>
        {error && <ThemedText type="small">Error: {String(error)}</ThemedText>}
      </ThemedView>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.history}
        renderItem={({ item }) => (
          <View style={item.role === 'user' ? styles.userBubble : styles.assistantBubble}>
            <ThemedText>{item.text}</ThemedText>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={isReady ? 'Type a message...' : 'Waiting for model...'}
          editable={!!isReady}
          multiline
        />
        {sendingRef.current ? (
          <ActivityIndicator style={styles.sendButton} />
        ) : (
          <Button title="Send" onPress={send} disabled={!isReady || !input.trim()} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, gap: 8 },
  history: { paddingHorizontal: 8, paddingBottom: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#E6F4FE', padding: 8, borderRadius: 8, marginVertical: 6 },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#F1F1F1', padding: 8, borderRadius: 8, marginVertical: 6 },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8 },
  sendButton: { marginLeft: 8 },
});
