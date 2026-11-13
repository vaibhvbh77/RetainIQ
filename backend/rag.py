
from pathlib import Path
import os

import chromadb
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from langsmith import traceable
from langsmith.wrappers import wrap_openai

# 1. Load environment variables
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

load_dotenv(PROJECT_DIR / ".env")

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OpenAI API key not found!")

client = wrap_openai(OpenAI(api_key=api_key))

# 2. Load embedding model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# 3. Connect to existing ChromaDB
chroma_client = chromadb.PersistentClient(
    path=str(BASE_DIR / "chroma_db")
)

collection = chroma_client.get_collection(
    name="retainiq_knowledge"
)


# 4. Retrieve relevant chunks
@traceable(name="Retrieve Knowledge")
def retrieve_context(question, top_k=4):

    query_embedding = embedding_model.encode(
        [question]
    ).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k
    )

    chunks = []

    for doc, metadata in zip(
        results["documents"][0],
        results["metadatas"][0]
    ):
        chunks.append({
            "text": doc,
            "page": metadata["page"],
            "source": metadata["source"]
        })

    return chunks





# 5. Generate answer using OpenAI
@traceable(name="Generate RAG Answer")
def generate_answer(question, context):

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": """
                You are the RetainIQ Customer Retention Assistant.
                Answer using the provided knowledge base context.
Do not invent company policies or customer information.
If the context does not contain enough information,
    clearly mention that.

                """
            },
            {
                "role": "user",
                "content": f"""
                Knowledge Base Context:
                {context}

                Manager's Question:
                {question}

                Provide a clear and actionable answer.
                """
            }
        ],
        temperature=0.3,
        max_tokens=400
    )

    return response.choices[0].message.content


# 6. Complete RAG workflow
@traceable(name="RetainIQ RAG Pipeline")
def ask_retainiq(question):

    context = retrieve_context(question)

    answer = generate_answer(question, context)

    return answer


# 7. Test from terminal
if __name__ == "__main__":

    while True:
        question = input("\nAsk RetainIQ (type exit to quit): ")

        if question.lower() == "exit":
            break

        answer = ask_retainiq(question)

        print("\nRetainIQ Assistant:")
        print(answer)

@traceable(name="Customer Retention Assistant")
def ask_customer_retainiq(question, customer):

    # 1. Retrieve relevant PDF knowledge
    chunks = retrieve_context(question)

    context = "\n\n".join(
        f"[PDF Page {chunk['page']}]\n{chunk['text']}"
        for chunk in chunks
    )

    # 2. Prepare customer information
    customer_context = "\n".join(
        f"{key}: {value}"
        for key, value in customer.items()
    )

    # 3. Ask the LLM
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": """
                You are the RetainIQ Customer Retention Assistant.

                Use the customer information and PDF knowledge
                provided to answer the manager.

                Rules:
                1. Distinguish customer attributes from model estimates.
                2. Churn probability is a model estimate, not a guarantee.
                3. Do not claim that a particular feature caused churn.
                4. Do not invent customer information or company policies.
                5. Base retention recommendations on retrieved PDF content.
                6. Cite supporting PDF page numbers.
                7. If the PDF does not support a recommendation,
                   clearly mention this.
                8. Do not confuse correlation with causation.
                """
            },
            {
                "role": "user",
                "content": f"""
                CUSTOMER INFORMATION:
                {customer_context}

                RETRIEVED PDF KNOWLEDGE:
                {context}

                MANAGER QUESTION:
                {question}

                Explain the customer's risk and suggest
                relevant retention actions.
                """
            }
        ],
        temperature=0,
        max_tokens=500
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": [
            {
                "page": chunk["page"],
                "source": chunk["source"]
            }
            for chunk in chunks
        ]
    }