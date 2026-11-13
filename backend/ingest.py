import fitz
import chromadb

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer


PDF_PATH = "RetainIQ_Customer_Retention_Knowledge_Base.pdf"

# 1. Extract text from PDF
document = fitz.open(PDF_PATH)

pages = []

for page_number, page in enumerate(document):
    pages.append({
        "text": page.get_text(),
        "page": page_number + 1
    })

# 2. Split text into chunks
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=100
)

chunks = []

for page in pages:
    page_chunks = splitter.split_text(page["text"])

    for chunk in page_chunks:
        chunks.append({
            "text": chunk,
            "page": page["page"]
        })

# 3. Generate embeddings
model = SentenceTransformer("all-MiniLM-L6-v2")

texts = [chunk["text"] for chunk in chunks]

embeddings = model.encode(texts).tolist()

# 4. Store in Chroma
client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = client.get_or_create_collection(
    name="retainiq_knowledge"
)

collection.upsert(
    ids=[str(i) for i in range(len(chunks))],
    documents=texts,
    embeddings=embeddings,
    metadatas=[
        {"page": chunk["page"], "source": PDF_PATH}
        for chunk in chunks
    ]
)

print(f"Successfully stored {len(chunks)} chunks!")