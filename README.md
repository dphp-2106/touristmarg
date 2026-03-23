# 🪨 StoneStories
### *Every Stone Has a Story*

> An AI-powered heritage exploration platform that transforms silent ancient temples and carvings into living, interactive experiences.

---

## 📖 About the Project

StoneStories is a high-end, AI-powered Indian heritage and temple guide application. Users upload a photo of any Indian temple, cave, fort, or heritage site and instantly receive detailed history, mythology, and stories behind it — like having a personal expert guide available 24/7.

What makes it unique is the **Specific Carving Mode** — upload just one carved wall or panel and the AI reads it like a book, explaining which scene from the Ramayana, Mahabharata, or Puranas is depicted, who the characters are, and what story is being told — panel by panel.

---

## ✨ Features

### 🔍 AI Vision Analysis
- **Full Site Mode** — Complete history and mythology of any temple or heritage site
- **Specific Carving Mode** — Panel-by-panel explanation of carved walls, sculptures, and artwork
- **Temple Name Hint** — Optional field to tell the AI which site it is for maximum accuracy
- **Google Search Grounding** — Real-time web search to verify facts and fetch accurate historical data
- **Confidence Indicator** — Honestly flags when AI is uncertain instead of guessing wrong

### 📚 Deep Dive Content
- **Quick Highlights** — 2-3 sentence instant summary for travelers on the move
- **History Tab** — 5-7 detailed paragraphs covering dynasty, construction, architectural style, and historical significance
- **Story & Mythology Tab** — Legends, myths, deity associations, and local folklore
- **The Carving Tab** — Exclusive to Specific Carving Mode — scene by scene explanation
- **Did You Know** — 3 surprising hidden facts most tourists never discover

### 🪨 Ask the Stone — Live Q&A
- AI speaks in first person as the temple itself *("I have stood here for centuries...")*
- Ask anything — "Why is Ganesh shown without a trunk here?" "What happened during the invasion?"
- Dynamic follow-up suggestions after every response
- Full conversation history maintained throughout the session

### 🎙️ Audio Guide
- Built-in TTS narrates the active tab content
- Context-aware — reads whatever section the user is currently viewing
- Feels like a real human guide narrating while you walk and explore

### 🌐 Multilingual Support
- Fully localized in **8 Indian languages**
- English, Hindi (हिन्दी), Gujarati (ગુજરાતી), Tamil (தமிழ்), Bengali (বাংলা), Marathi (मराठी), Telugu (తెలుగు), Kannada (ಕನ್ನಡ)
- All AI content, UI text, audio narration, and suggested questions translated

### 📥 Offline Library
- Save any heritage guide to your device before visiting
- Full access without internet — critical for remote temples and cave sites
- View complete history, mythology, and trivia offline

### 👥 Community Stories
- Submit local legends and folklore not found in any history book
- Upvoting system — sort stories by Recent or Most Upvoted
- Every story credited to the person who shared it
- Preserves oral traditions that would otherwise be lost forever

### 📸 Dual Input Modes
- **Live Camera** — Direct camera capture on mobile for on-site exploration
- **Gallery Upload** — Drag and drop from desktop or file picker on mobile

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Icons | Lucide Icons |
| AI Vision & Chat | Gemini 3 Flash |
| Audio Narration | Gemini 2.5 Flash TTS |
| Search Grounding | Google Search API |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Gemini API Key
- Google Search API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/stonestories.git

# Navigate into the project
cd stonestories

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the root directory and add the following —

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GOOGLE_SEARCH_API_KEY=your_google_search_api_key_here
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

---

## 📁 Project Structure

```
stonestories/
├── public/
│   └── assets/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── HomePage.tsx
│   │   ├── ExplorePage.tsx
│   │   ├── ResultsPage.tsx
│   │   ├── AskTheStone.tsx
│   │   ├── OfflineLibrary.tsx
│   │   └── CommunityPage.tsx
│   ├── services/
│   │   ├── analyzeHeritageImage.ts
│   │   ├── chatWithStone.ts
│   │   ├── generateAudio.ts
│   │   └── translateHeritageInfo.ts
│   ├── types/
│   │   └── heritage.ts
│   ├── utils/
│   │   └── helpers.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── vercel.json
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🗺️ Roadmap

- [x] AI image analysis with dual mode
- [x] History and mythology content generation
- [x] Ask the Stone live Q&A
- [x] Audio narration
- [x] 8 language support
- [x] Offline library
- [x] Community stories with upvoting
- [x] Live camera capture
- [x] Google Search grounding for accuracy
- [ ] Animated 3D architectural visualization (Phase 1)
- [ ] Google Street View 360° virtual temple tours
- [ ] Heritage Passport with badges and collections
- [ ] Pilgrimage Mode for religious visitors
- [ ] Nearby Heritage Finder with GPS
- [ ] AR camera overlay with real-time labels
- [ ] Children's Story Mode
- [ ] ASI partnership for exclusive 3D content

---

## 🌍 Why StoneStories Exists

India has thousands of temples and heritage sites where there is **no guide, no information board, no explanation** — just ancient structures standing silently. Most people walk past incredible history without ever knowing what they are looking at.

StoneStories gives a voice to every stone, every carving, and every wall that has a story to tell but no one to tell it. It is not just a tourism app — it is a **time machine** and a **guardian of stories** that would otherwise be lost forever.

---

## 🤝 Contributing

Contributions are welcome — especially for adding heritage site data, translations, and community stories.

```bash
# Fork the repository
# Create a feature branch
git checkout -b feature/your-feature-name

# Commit your changes
git commit -m "Add: your feature description"

# Push to your branch
git push origin feature/your-feature-name

# Open a Pull Request
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- Archaeological Survey of India (ASI) for heritage documentation
- Google Arts & Culture for virtual heritage initiatives
- All the historians, priests, and local guides whose knowledge inspired this project
- Every traveler who ever stood before an ancient carving and wondered — *what does this mean?*

---

<div align="center">

**Built with ❤️ for India's ancient heritage**

*"Every stone has a story. StoneStories makes sure it is heard."*

</div>
