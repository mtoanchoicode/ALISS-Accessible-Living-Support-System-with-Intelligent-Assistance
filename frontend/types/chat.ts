export interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  audio_base64?: string;
  audio_mime?: string;
}

export interface Session {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messages: Message[];
}
