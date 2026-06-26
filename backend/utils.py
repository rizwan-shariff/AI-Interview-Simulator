import tempfile
from gtts import gTTS
from duckduckgo_search import DDGS
from streamlit_webrtc import VideoProcessorBase
import cv2

def search_web_for_answer(question):
    try:
        results = DDGS().text(f"best interview answer to {question}", max_results=2)
        return " ".join([res['body'] for res in results]) if results else ""
    except Exception:
        return ""

def play_audio_question(text):
    try:
        tts = gTTS(text=text, lang='en', slow=False)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
            tts.save(fp.name)
            return fp.name
    except Exception:
        return None

class SnapshotProcessor(VideoProcessorBase):
    def __init__(self):
        self.current_frame = None
        
    def recv(self, frame):
        img = frame.to_ndarray(format="bgr24")
        try:
            self.current_frame = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        except Exception:
            pass
        return frame
