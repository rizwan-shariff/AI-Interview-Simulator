from duckduckgo_search import DDGS

def search_web_for_answer(question):
    try:
        results = DDGS().text(f"best interview answer to {question}", max_results=2)
        return " ".join([res['body'] for res in results]) if results else ""
    except Exception:
        return ""
