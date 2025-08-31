# RAG Pipeline Implementation in Node.js

## Overview
This guide implements a complete Retrieval-Augmented Generation (RAG) pipeline using Node.js, covering document processing, embedding generation, vector storage, semantic search, and response generation.

## Prerequisites
```bash
npm init -y
npm install @xenova/transformers openai pdf-parse mammoth cheerio axios dotenv uuid faiss-node express multer
```

## Project Structure
```
rag-pipeline/
├── src/
│   ├── embeddings/
│   │   └── embedder.js
│   ├── vectorstore/
│   │   └── vectorStore.js
│   ├── retrieval/
│   │   └── retriever.js
│   ├── generation/
│   │   └── generator.js
│   ├── document-processing/
│   │   └── processor.js
│   ├── pipeline/
│   │   └── ragPipeline.js
│   └── server.js
├── uploads/
├── data/
└── .env
```

## Step 1: Environment Configuration

Create `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4
VECTOR_DIMENSION=1536
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K_RESULTS=5
```

## Step 2: Document Processing Module

**src/document-processing/processor.js**
```javascript
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');

class DocumentProcessor {
  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  async processDocument(filePath, fileType) {
    try {
      let text = '';
      
      switch (fileType.toLowerCase()) {
        case 'pdf':
          text = await this.processPDF(filePath);
          break;
        case 'docx':
          text = await this.processDOCX(filePath);
          break;
        case 'txt':
          text = await this.processTXT(filePath);
          break;
        case 'html':
          text = await this.processHTML(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      const chunks = this.chunkText(text);
      return this.createDocuments(chunks, filePath);
    } catch (error) {
      console.error(`Error processing document ${filePath}:`, error);
      throw error;
    }
  }

  async processPDF(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  async processDOCX(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  async processTXT(filePath) {
    return await fs.readFile(filePath, 'utf8');
  }

  async processHTML(filePath) {
    const html = await fs.readFile(filePath, 'utf8');
    const $ = cheerio.load(html);
    return $.text();
  }

  chunkText(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length <= this.chunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }

    return this.applyOverlap(chunks);
  }

  applyOverlap(chunks) {
    if (chunks.length <= 1) return chunks;
    
    const overlappedChunks = [chunks[0]];
    
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];
      
      const overlapWords = prevChunk.split(' ').slice(-this.chunkOverlap / 10);
      const overlappedChunk = overlapWords.join(' ') + ' ' + currentChunk;
      
      overlappedChunks.push(overlappedChunk);
    }
    
    return overlappedChunks;
  }

  createDocuments(chunks, source) {
    return chunks.map((chunk, index) => ({
      id: uuidv4(),
      content: chunk,
      metadata: {
        source,
        chunkIndex: index,
        timestamp: new Date().toISOString(),
        length: chunk.length
      }
    }));
  }

  async processMultipleDocuments(filePaths) {
    const allDocuments = [];
    
    for (const filePath of filePaths) {
      const fileType = filePath.split('.').pop();
      const documents = await this.processDocument(filePath, fileType);
      allDocuments.push(...documents);
    }
    
    return allDocuments;
  }
}

module.exports = DocumentProcessor;
```

## Step 3: Embedding Generation Module

**src/embeddings/embedder.js**
```javascript
const { pipeline } = require('@xenova/transformers');
const OpenAI = require('openai');

class EmbeddingGenerator {
  constructor(provider = 'openai', model = 'text-embedding-3-small') {
    this.provider = provider;
    this.model = model;
    this.openai = provider === 'openai' ? new OpenAI() : null;
    this.localPipeline = null;
  }

  async initialize() {
    if (this.provider === 'local') {
      console.log('Loading local embedding model...');
      this.localPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
  }

  async generateEmbedding(text) {
    try {
      if (this.provider === 'openai') {
        return await this.generateOpenAIEmbedding(text);
      } else if (this.provider === 'local') {
        return await this.generateLocalEmbedding(text);
      } else {
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generateOpenAIEmbedding(text) {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text,
      encoding_format: 'float'
    });
    
    return response.data[0].embedding;
  }

  async generateLocalEmbedding(text) {
    if (!this.localPipeline) {
      await this.initialize();
    }
    
    const output = await this.localPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async generateBatchEmbeddings(texts, batchSize = 10) {
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
      
      if (this.provider === 'openai') {
        const batchEmbeddings = await this.generateOpenAIBatchEmbeddings(batch);
        embeddings.push(...batchEmbeddings);
      } else {
        const batchPromises = batch.map(text => this.generateEmbedding(text));
        const batchEmbeddings = await Promise.all(batchPromises);
        embeddings.push(...batchEmbeddings);
      }
      
      // Rate limiting for API calls
      if (this.provider === 'openai' && i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return embeddings;
  }

  async generateOpenAIBatchEmbeddings(texts) {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts,
      encoding_format: 'float'
    });
    
    return response.data.map(item => item.embedding);
  }
}

module.exports = EmbeddingGenerator;
```

## Step 4: Vector Store Module

**src/vectorstore/vectorStore.js**
```javascript
const fs = require('fs').promises;
const path = require('path');

class VectorStore {
  constructor(dimension = 1536) {
    this.dimension = dimension;
    this.vectors = [];
    this.metadata = [];
    this.index = null;
  }

  async addDocuments(documents, embeddings) {
    if (documents.length !== embeddings.length) {
      throw new Error('Documents and embeddings arrays must have the same length');
    }

    for (let i = 0; i < documents.length; i++) {
      this.vectors.push(embeddings[i]);
      this.metadata.push(documents[i]);
    }

    console.log(`Added ${documents.length} documents to vector store`);
  }

  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async similaritySearch(queryEmbedding, topK = 5) {
    if (this.vectors.length === 0) {
      return [];
    }

    const similarities = this.vectors.map((vector, index) => ({
      similarity: this.cosineSimilarity(queryEmbedding, vector),
      document: this.metadata[index],
      index
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, topK).map(item => ({
      document: item.document,
      similarity: item.similarity
    }));
  }

  async saveToFile(filePath) {
    const data = {
      vectors: this.vectors,
      metadata: this.metadata,
      dimension: this.dimension
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Vector store saved to ${filePath}`);
  }

  async loadFromFile(filePath) {
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      this.vectors = data.vectors;
      this.metadata = data.metadata;
      this.dimension = data.dimension;
      console.log(`Vector store loaded from ${filePath}`);
    } catch (error) {
      console.error('Error loading vector store:', error);
      throw error;
    }
  }

  getStats() {
    return {
      totalDocuments: this.vectors.length,
      dimension: this.dimension,
      memoryUsage: (this.vectors.length * this.dimension * 8) / (1024 * 1024) // MB
    };
  }

  clear() {
    this.vectors = [];
    this.metadata = [];
  }
}

module.exports = VectorStore;
```

## Step 5: Retrieval Module

**src/retrieval/retriever.js**
```javascript
class Retriever {
  constructor(vectorStore, embedder, topK = 5, similarityThreshold = 0.7) {
    this.vectorStore = vectorStore;
    this.embedder = embedder;
    this.topK = topK;
    this.similarityThreshold = similarityThreshold;
  }

  async retrieve(query) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embedder.generateEmbedding(query);
      
      // Perform similarity search
      const results = await this.vectorStore.similaritySearch(queryEmbedding, this.topK);
      
      // Filter by similarity threshold
      const filteredResults = results.filter(result => 
        result.similarity >= this.similarityThreshold
      );

      // Format results for context
      const context = this.formatContext(filteredResults);
      
      return {
        context,
        sources: filteredResults.map(result => ({
          source: result.document.metadata.source,
          similarity: result.similarity,
          chunkIndex: result.document.metadata.chunkIndex
        }))
      };
    } catch (error) {
      console.error('Error during retrieval:', error);
      throw error;
    }
  }

  formatContext(results) {
    if (results.length === 0) {
      return "No relevant context found.";
    }

    return results
      .map((result, index) => {
        const doc = result.document;
        return `[Context ${index + 1}] (Similarity: ${result.similarity.toFixed(3)})
Source: ${doc.metadata.source}
Content: ${doc.content}`;
      })
      .join('\n\n');
  }

  async retrieveWithReranking(query, rerankingModel = null) {
    const initialResults = await this.retrieve(query);
    
    if (!rerankingModel || initialResults.sources.length <= 1) {
      return initialResults;
    }

    // Simple reranking based on query term overlap
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const rerankedSources = initialResults.sources.map(source => {
      const content = source.content?.toLowerCase() || '';
      const overlap = queryTerms.filter(term => content.includes(term)).length;
      return {
        ...source,
        rerankScore: overlap / queryTerms.length
      };
    }).sort((a, b) => b.rerankScore - a.rerankScore);

    return {
      ...initialResults,
      sources: rerankedSources
    };
  }

  updateTopK(newTopK) {
    this.topK = newTopK;
  }

  updateSimilarityThreshold(newThreshold) {
    this.similarityThreshold = newThreshold;
  }
}

module.exports = Retriever;
```

## Step 6: Response Generation Module

**src/generation/generator.js**
```javascript
const OpenAI = require('openai');

class ResponseGenerator {
  constructor(model = 'gpt-4', temperature = 0.7) {
    this.openai = new OpenAI();
    this.model = model;
    this.temperature = temperature;
  }

  async generateResponse(query, context, systemPrompt = null) {
    try {
      const defaultSystemPrompt = `You are a helpful AI assistant that answers questions based on the provided context. 
Use the context information to provide accurate and relevant answers. 
If the context doesn't contain enough information to answer the question, say so clearly.
Always cite which context sections you're using in your response.`;

      const messages = [
        {
          role: 'system',
          content: systemPrompt || defaultSystemPrompt
        },
        {
          role: 'user',
          content: this.buildPrompt(query, context)
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: 1000
      });

      return {
        response: response.choices[0].message.content,
        usage: response.usage,
        model: this.model
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  buildPrompt(query, context) {
    return `Context Information:
${context}

Question: ${query}

Please provide a comprehensive answer based on the context above. If you reference specific information, please indicate which context section it comes from.`;
  }

  async generateStreamingResponse(query, context, systemPrompt = null) {
    const defaultSystemPrompt = `You are a helpful AI assistant that answers questions based on the provided context.`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt || defaultSystemPrompt
      },
      {
        role: 'user',
        content: this.buildPrompt(query, context)
      }
    ];

    const stream = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: 1000,
      stream: true
    });

    return stream;
  }

  setTemperature(temperature) {
    this.temperature = temperature;
  }

  setModel(model) {
    this.model = model;
  }
}

module.exports = ResponseGenerator;
```

## Step 7: Main RAG Pipeline

**src/pipeline/ragPipeline.js**
```javascript
const DocumentProcessor = require('../document-processing/processor');
const EmbeddingGenerator = require('../embeddings/embedder');
const VectorStore = require('../vectorstore/vectorStore');
const Retriever = require('../retrieval/retriever');
const ResponseGenerator = require('../generation/generator');

class RAGPipeline {
  constructor(config = {}) {
    this.config = {
      chunkSize: config.chunkSize || 1000,
      chunkOverlap: config.chunkOverlap || 200,
      vectorDimension: config.vectorDimension || 1536,
      topK: config.topK || 5,
      similarityThreshold: config.similarityThreshold || 0.7,
      embeddingProvider: config.embeddingProvider || 'openai',
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
      llmModel: config.llmModel || 'gpt-4',
      ...config
    };

    this.processor = new DocumentProcessor(
      this.config.chunkSize,
      this.config.chunkOverlap
    );
    
    this.embedder = new EmbeddingGenerator(
      this.config.embeddingProvider,
      this.config.embeddingModel
    );
    
    this.vectorStore = new VectorStore(this.config.vectorDimension);
    
    this.retriever = new Retriever(
      this.vectorStore,
      this.embedder,
      this.config.topK,
      this.config.similarityThreshold
    );
    
    this.generator = new ResponseGenerator(
      this.config.llmModel,
      this.config.temperature || 0.7
    );

    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      await this.embedder.initialize();
      this.isInitialized = true;
      console.log('RAG Pipeline initialized successfully');
    }
  }

  async addDocuments(filePaths) {
    await this.initialize();
    
    try {
      console.log(`Processing ${filePaths.length} documents...`);
      
      // Process documents
      const documents = await this.processor.processMultipleDocuments(filePaths);
      console.log(`Created ${documents.length} chunks from documents`);
      
      // Generate embeddings
      const texts = documents.map(doc => doc.content);
      const embeddings = await this.embedder.generateBatchEmbeddings(texts);
      console.log(`Generated ${embeddings.length} embeddings`);
      
      // Add to vector store
      await this.vectorStore.addDocuments(documents, embeddings);
      
      return {
        documentsProcessed: filePaths.length,
        chunksCreated: documents.length,
        embeddingsGenerated: embeddings.length
      };
    } catch (error) {
      console.error('Error adding documents:', error);
      throw error;
    }
  }

  async query(question, options = {}) {
    await this.initialize();
    
    try {
      console.log(`Processing query: "${question}"`);
      
      // Retrieve relevant context
      const retrievalResult = await this.retriever.retrieve(question);
      
      if (retrievalResult.sources.length === 0) {
        return {
          response: "I couldn't find any relevant information to answer your question.",
          sources: [],
          context: "No relevant context found."
        };
      }
      
      // Generate response
      const generationResult = await this.generator.generateResponse(
        question,
        retrievalResult.context,
        options.systemPrompt
      );
      
      return {
        response: generationResult.response,
        sources: retrievalResult.sources,
        context: retrievalResult.context,
        usage: generationResult.usage
      };
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  async queryStreaming(question, options = {}) {
    await this.initialize();
    
    const retrievalResult = await this.retriever.retrieve(question);
    
    if (retrievalResult.sources.length === 0) {
      return {
        stream: null,
        sources: [],
        message: "No relevant context found."
      };
    }
    
    const stream = await this.generator.generateStreamingResponse(
      question,
      retrievalResult.context,
      options.systemPrompt
    );
    
    return {
      stream,
      sources: retrievalResult.sources,
      context: retrievalResult.context
    };
  }

  async saveVectorStore(filePath) {
    await this.vectorStore.saveToFile(filePath);
  }

  async loadVectorStore(filePath) {
    await this.vectorStore.loadFromFile(filePath);
  }

  getStats() {
    return {
      pipeline: this.config,
      vectorStore: this.vectorStore.getStats()
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update components with new config
    if (newConfig.topK) {
      this.retriever.updateTopK(newConfig.topK);
    }
    
    if (newConfig.similarityThreshold) {
      this.retriever.updateSimilarityThreshold(newConfig.similarityThreshold);
    }
    
    if (newConfig.temperature) {
      this.generator.setTemperature(newConfig.temperature);
    }
    
    if (newConfig.llmModel) {
      this.generator.setModel(newConfig.llmModel);
    }
  }
}

module.exports = RAGPipeline;
```

## Step 8: Express Server Implementation

**src/server.js**
```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const RAGPipeline = require('./pipeline/ragPipeline');

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt', '.html'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${fileExt}`));
    }
  }
});

// Initialize RAG pipeline
const ragConfig = {
  chunkSize: parseInt(process.env.CHUNK_SIZE) || 1000,
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 200,
  vectorDimension: parseInt(process.env.VECTOR_DIMENSION) || 1536,
  topK: parseInt(process.env.TOP_K_RESULTS) || 5,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  llmModel: process.env.LLM_MODEL || 'gpt-4'
};

const pipeline = new RAGPipeline(ragConfig);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await fs.access('uploads');
  } catch {
    await fs.mkdir('uploads', { recursive: true });
  }
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Upload and process documents
app.post('/upload', upload.array('documents'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const filePaths = req.files.map(file => file.path);
    const result = await pipeline.addDocuments(filePaths);
    
    // Clean up uploaded files after processing
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`Could not delete file ${filePath}:`, error.message);
      }
    }

    res.json({
      message: 'Documents processed successfully',
      ...result
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Query endpoint
app.post('/query', async (req, res) => {
  try {
    const { question, options = {} } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const result = await pipeline.query(question, options);
    res.json(result);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Streaming query endpoint
app.post('/query/stream', async (req, res) => {
  try {
    const { question, options = {} } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const result = await pipeline.queryStreaming(question, options);
    
    if (!result.stream) {
      return res.json({ message: result.message, sources: result.sources });
    }

    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    });

    // Send sources first
    res.write(`Sources: ${JSON.stringify(result.sources)}\n\n`);

    // Stream the response
    for await (const chunk of result.stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(content);
      }
    }

    res.end();
  } catch (error) {
    console.error('Streaming query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pipeline statistics
app.get('/stats', (req, res) => {
  try {
    const stats = pipeline.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save vector store
app.post('/save', async (req, res) => {
  try {
    const { filename = 'vectorstore.json' } = req.body;
    const filePath = path.join('data', filename);
    
    // Ensure data directory exists
    await fs.mkdir('data', { recursive: true });
    
    await pipeline.saveVectorStore(filePath);
    res.json({ message: `Vector store saved to ${filePath}` });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load vector store
app.post('/load', async (req, res) => {
  try {
    const { filename = 'vectorstore.json' } = req.body;
    const filePath = path.join('data', filename);
    
    await pipeline.loadVectorStore(filePath);
    res.json({ message: `Vector store loaded from ${filePath}` });
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update pipeline configuration
app.put('/config', (req, res) => {
  try {
    pipeline.updateConfig(req.body);
    res.json({ 
      message: 'Configuration updated',
      config: pipeline.config 
    });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  await ensureUploadsDir();
  
  app.listen(port, () => {
    console.log(`RAG Pipeline server running on port ${port}`);
    console.log(`Upload documents: POST /upload`);
    console.log(`Query: POST /query`);
    console.log(`Stream query: POST /query/stream`);
    console.log(`Stats: GET /stats`);
  });
};

startServer().catch(console.error);
```

## Step 9: Usage Examples

**examples/basicUsage.js**
```javascript
const RAGPipeline = require('../src/pipeline/ragPipeline');
require('dotenv').config();

async function basicExample() {
  const pipeline = new RAGPipeline({
    topK: 3,
    similarityThreshold: 0.75
  });

  try {
    // Add documents to the pipeline
    const filePaths = ['./data/document1.pdf', './data/document2.txt'];
    await pipeline.addDocuments(filePaths);
    
    // Query the pipeline
    const result = await pipeline.query('What is the main topic discussed in the documents?');
    
    console.log('Response:', result.response);
    console.log('Sources:', result.sources);
    console.log('Usage:', result.usage);
    
    // Save vector store for later use
    await pipeline.saveVectorStore('./data/my_vectorstore.json');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

basicExample();
```

**examples/advancedUsage.js**
```javascript
const RAGPipeline = require('../src/pipeline/ragPipeline');
require('dotenv').config();

async function advancedExample() {
  const pipeline = new RAGPipeline({
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-3-small',
    llmModel: 'gpt-4',
    chunkSize: 800,
    chunkOverlap: 150,
    topK: 5,
    similarityThreshold: 0.7
  });

  try {
    // Load existing vector store if it exists
    try {
      await pipeline.loadVectorStore('./data/knowledge_base.json');
      console.log('Loaded existing vector store');
    } catch {
      console.log('No existing vector store found, will create new one');
    }

    // Add new documents
    const newDocuments = ['./data/research_paper.pdf', './data/manual.docx'];
    await pipeline.addDocuments(newDocuments);

    // Custom system prompt for domain-specific responses
    const systemPrompt = `You are an expert technical assistant. 
    Provide detailed, technical answers based on the provided context. 
    Include specific references to the source documents and page numbers when available.
    If technical terms are used, provide brief explanations.`;

    // Query with custom options
    const result = await pipeline.query(
      'Explain the implementation details of the proposed algorithm',
      { systemPrompt }
    );

    console.log('Technical Response:', result.response);
    
    // Get pipeline statistics
    const stats = pipeline.getStats();
    console.log('Pipeline Stats:', stats);
    
    // Update configuration dynamically
    pipeline.updateConfig({
      topK: 7,
      temperature: 0.3
    });

    // Save updated vector store
    await pipeline.saveVectorStore('./data/knowledge_base.json');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

advancedExample();
```

## Step 10: API Client Example

**examples/apiClient.js**
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class RAGAPIClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.axios = axios.create({ baseURL });
  }

  async uploadDocuments(filePaths) {
    const formData = new FormData();
    
    for (const filePath of filePaths) {
      formData.append('documents', fs.createReadStream(filePath));
    }

    const response = await this.axios.post('/upload', formData, {
      headers: formData.getHeaders()
    });
    
    return response.data;
  }

  async query(question, options = {}) {
    const response = await this.axios.post('/query', {
      question,
      options
    });
    
    return response.data;
  }

  async queryStream(question, options = {}) {
    const response = await this.axios.post('/query/stream', {
      question,
      options
    }, {
      responseType: 'stream'
    });
    
    return response.data;
  }

  async getStats() {
    const response = await this.axios.get('/stats');
    return response.data;
  }

  async saveVectorStore(filename) {
    const response = await this.axios.post('/save', { filename });
    return response.data;
  }

  async loadVectorStore(filename) {
    const response = await this.axios.post('/load', { filename });
    return response.data;
  }

  async updateConfig(config) {
    const response = await this.axios.put('/config', config);
    return response.data;
  }
}

// Usage example
async function clientExample() {
  const client = new RAGAPIClient();
  
  try {
    // Upload documents
    await client.uploadDocuments(['./data/document.pdf']);
    
    // Query
    const result = await client.query('What are the key findings?');
    console.log(result.response);
    
    // Get statistics
    const stats = await client.getStats();
    console.log('Pipeline stats:', stats);
    
  } catch (error) {
    console.error('Client error:', error.response?.data || error.message);
  }
}

module.exports = RAGAPIClient;
```

## Step 11: Testing Framework

**tests/ragPipeline.test.js**
```javascript
const RAGPipeline = require('../src/pipeline/ragPipeline');
const fs = require('fs').promises;
const path = require('path');

class RAGTester {
  constructor() {
    this.testResults = [];
  }

  async createTestDocument(content, filename) {
    await fs.writeFile(filename, content);
    return filename;
  }

  async runTest(testName, testFunction) {
    console.log(`\nRunning test: ${testName}`);
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      console.log(`✅ ${testName} passed (${duration}ms)`);
      this.testResults.push({ name: testName, status: 'passed', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${testName} failed (${duration}ms):`, error.message);
      this.testResults.push({ name: testName, status: 'failed', duration, error: error.message });
    }
  }

  async runAllTests() {
    console.log('Starting RAG Pipeline Tests...\n');

    // Test 1: Document Processing
    await this.runTest('Document Processing', async () => {
      const testContent = `This is a test document. It contains multiple sentences. 
      The content should be chunked properly. Each chunk should overlap with the next.
      This helps maintain context continuity across chunks.`;
      
      const testFile = await this.createTestDocument(testContent, './test_document.txt');
      
      const pipeline = new RAGPipeline({ chunkSize: 100, chunkOverlap: 20 });
      const result = await pipeline.addDocuments([testFile]);
      
      if (result.chunksCreated === 0) {
        throw new Error('No chunks were created');
      }
      
      await fs.unlink(testFile);
    });

    // Test 2: Vector Store Operations
    await this.runTest('Vector Store Operations', async () => {
      const pipeline = new RAGPipeline();
      
      const testDoc = await this.createTestDocument(
        'Vector stores are essential for RAG systems.',
        './test_vector.txt'
      );
      
      await pipeline.addDocuments([testDoc]);
      
      const stats = pipeline.getStats();
      if (stats.vectorStore.totalDocuments === 0) {
        throw new Error('No documents in vector store');
      }
      
      await fs.unlink(testDoc);
    });

    // Test 3: Retrieval and Generation
    await this.runTest('Retrieval and Generation', async () => {
      const testContent = `Artificial Intelligence is transforming industries worldwide. 
      Machine learning algorithms can process vast amounts of data. 
      Natural language processing enables computers to understand human language.
      Computer vision allows machines to interpret visual information.`;
      
      const testDoc = await this.createTestDocument(testContent, './test_ai.txt');
      
      const pipeline = new RAGPipeline({ topK: 2 });
      await pipeline.addDocuments([testDoc]);
      
      const result = await pipeline.query('What is artificial intelligence?');
      
      if (!result.response || result.response.length === 0) {
        throw new Error('No response generated');
      }
      
      if (result.sources.length === 0) {
        throw new Error('No sources retrieved');
      }
      
      await fs.unlink(testDoc);
    });

    // Test 4: Vector Store Persistence
    await this.runTest('Vector Store Persistence', async () => {
      const testContent = 'This is persistence test content for vector store operations.';
      const testDoc = await this.createTestDocument(testContent, './test_persist.txt');
      const storeFile = './test_store.json';
      
      // Create and save
      const pipeline1 = new RAGPipeline();
      await pipeline1.addDocuments([testDoc]);
      await pipeline1.saveVectorStore(storeFile);
      
      // Load in new pipeline
      const pipeline2 = new RAGPipeline();
      await pipeline2.loadVectorStore(storeFile);
      
      const stats = pipeline2.getStats();
      if (stats.vectorStore.totalDocuments === 0) {
        throw new Error('Vector store not loaded properly');
      }
      
      // Clean up
      await fs.unlink(testDoc);
      await fs.unlink(storeFile);
    });

    // Test 5: Configuration Updates
    await this.runTest('Configuration Updates', async () => {
      const pipeline = new RAGPipeline({ topK: 3 });
      
      pipeline.updateConfig({ topK: 5, temperature: 0.5 });
      
      if (pipeline.config.topK !== 5) {
        throw new Error('Configuration not updated properly');
      }
    });

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(t => t.status === 'passed').length;
    const failed = this.testResults.filter(t => t.status === 'failed').length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.testResults
        .filter(t => t.status === 'failed')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }
    
    console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%`);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new RAGTester();
  tester.runAllTests().catch(console.error);
}

module.exports = RAGTester;
```

## Step 12: Performance Optimization

**src/utils/optimizer.js**
```javascript
class RAGOptimizer {
  constructor(pipeline) {
    this.pipeline = pipeline;
    this.performanceMetrics = [];
  }

  async benchmarkRetrieval(queries, iterations = 3) {
    const results = [];
    
    for (const query of queries) {
      const queryMetrics = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await this.pipeline.query(query);
        const duration = Date.now() - startTime;
        
        queryMetrics.push({
          duration,
          sourcesFound: result.sources.length,
          relevanceScore: this.calculateRelevanceScore(result.sources)
        });
      }
      
      results.push({
        query,
        avgDuration: queryMetrics.reduce((sum, m) => sum + m.duration, 0) / iterations,
        avgSources: queryMetrics.reduce((sum, m) => sum + m.sourcesFound, 0) / iterations,
        avgRelevance: queryMetrics.reduce((sum, m) => sum + m.relevanceScore, 0) / iterations
      });
    }
    
    return results;
  }

  calculateRelevanceScore(sources) {
    if (sources.length === 0) return 0;
    return sources.reduce((sum, source) => sum + source.similarity, 0) / sources.length;
  }

  async optimizeChunkSize() {
    const chunkSizes = [500, 750, 1000, 1250, 1500];
    const testQuery = 'What is the main concept?';
    const results = [];
    
    for (const size of chunkSizes) {
      this.pipeline.updateConfig({ chunkSize: size });
      
      const startTime = Date.now();
      const result = await this.pipeline.query(testQuery);
      const duration = Date.now() - startTime;
      
      results.push({
        chunkSize: size,
        duration,
        sourcesFound: result.sources.length,
        relevanceScore: this.calculateRelevanceScore(result.sources)
      });
    }
    
    return results;
  }

  generateOptimizationReport(benchmarkResults) {
    return {
      timestamp: new Date().toISOString(),
      totalQueries: benchmarkResults.length,
      avgDuration: benchmarkResults.reduce((sum, r) => sum + r.avgDuration, 0) / benchmarkResults.length,
      avgSources: benchmarkResults.reduce((sum, r) => sum + r.avgSources, 0) / benchmarkResults.length,
      avgRelevance: benchmarkResults.reduce((sum, r) => sum + r.avgRelevance, 0) / benchmarkResults.length,
      recommendations: this.generateRecommendations(benchmarkResults)
    };
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    const avgDuration = results.reduce((sum, r) => sum + r.avgDuration, 0) / results.length;
    if (avgDuration > 5000) {
      recommendations.push('Consider reducing chunk size or using local embeddings for better performance');
    }
    
    const avgRelevance = results.reduce((sum, r) => sum + r.avgRelevance, 0) / results.length;
    if (avgRelevance < 0.7) {
      recommendations.push('Consider adjusting similarity threshold or improving document preprocessing');
    }
    
    return recommendations;
  }
}

module.exports = RAGOptimizer;
```

## Step 13: Docker Configuration

**Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY .env ./

# Create necessary directories
RUN mkdir -p uploads data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "src/server.js"]
```

**docker-compose.yml**
```yaml
version: '3.8'

services:
  rag-pipeline:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Step 14: Production Deployment Script

**scripts/deploy.js**
```javascript
const { exec } = require('child_process');
const fs = require('fs').promises;

class DeploymentManager {
  async validateEnvironment() {
    const requiredVars = ['OPENAI_API_KEY', 'EMBEDDING_MODEL', 'LLM_MODEL'];
    const missing = requiredVars.filter(var => !process.env[var]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  async createDirectories() {
    const dirs = ['uploads', 'data', 'logs'];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
  }

  async runHealthCheck() {
    return new Promise((resolve, reject) => {
      exec('curl -f http://localhost:3000/health', (error, stdout) => {
        if (error) {
          reject(new Error('Health check failed'));
        } else {
          resolve(JSON.parse(stdout));
        }
      });
    });
  }

  async deploy() {
    try {
      console.log('Starting deployment...');
      
      await this.validateEnvironment();
      await this.createDirectories();
      
      console.log('Starting RAG Pipeline server...');
      require('../src/server');
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await this.runHealthCheck();
      console.log('Deployment successful!');
      
    } catch (error) {
      console.error('Deployment failed:', error);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const deployer = new DeploymentManager();
  deployer.deploy();
}
```

## Step 15: Monitoring and Logging

**src/utils/monitor.js**
```javascript
const fs = require('fs').promises;
const path = require('path');

class RAGMonitor {
  constructor(logDirectory = './logs') {
    this.logDirectory = logDirectory;
    this.metrics = {
      totalQueries: 0,
      totalDocuments: 0,
      avgResponseTime: 0,
      avgRelevanceScore: 0,
      errorCount: 0
    };
  }

  async log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata
    };

    const logFile = path.join(this.logDirectory, `${level}.log`);
    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
  }

  async logQuery(query, result, duration) {
    this.metrics.totalQueries++;
    
    const relevanceScore = result.sources.length > 0
      ? result.sources.reduce((sum, s) => sum + s.similarity, 0) / result.sources.length
      : 0;
    
    this.updateAverageMetrics(duration, relevanceScore);
    
    await this.log('info', 'Query processed', {
      query,
      duration,
      sourcesFound: result.sources.length,
      relevanceScore,
      responseLength: result.response.length
    });
  }

  updateAverageMetrics(duration, relevanceScore) {
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalQueries - 1) + duration) / this.metrics.totalQueries;
    
    this.metrics.avgRelevanceScore = 
      (this.metrics.avgRelevanceScore * (this.metrics.totalQueries - 1) + relevanceScore) / this.metrics.totalQueries;
  }

  async logError(error, context = {}) {
    this.metrics.errorCount++;
    
    await this.log('error', error.message, {
      stack: error.stack,
      context
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  async generateReport() {
    const metrics = this.getMetrics();
    const report = `
RAG Pipeline Performance Report
Generated: ${metrics.timestamp}

Metrics:
- Total Queries: ${metrics.totalQueries}
- Total Documents: ${metrics.totalDocuments}
- Average Response Time: ${metrics.avgResponseTime.toFixed(2)}ms
- Average Relevance Score: ${metrics.avgRelevanceScore.toFixed(3)}
- Error Count: ${metrics.errorCount}
- Error Rate: ${((metrics.errorCount / metrics.totalQueries) * 100).toFixed(2)}%
    `;
    
    const reportFile = path.join(this.logDirectory, `report_${Date.now()}.txt`);
    await fs.writeFile(reportFile, report);
    
    return report;
  }
}

module.exports = RAGMonitor;
```

## Usage Instructions

### 1. Basic Setup
```bash
# Clone or create the project structure
mkdir rag-pipeline && cd rag-pipeline

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### 2. Running the Server
```bash
# Development
node src/server.js

# Production with Docker
docker-compose up -d
```

### 3. API Usage Examples

**Upload Documents:**
```bash
curl -X POST -F "documents=@document.pdf" http://localhost:3000/upload
```

**Query:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"question": "What are the main topics?"}' \
  http://localhost:3000/query
```

**Get Statistics:**
```bash
curl http://localhost:3000/stats
```

### 4. Programmatic Usage
```javascript
const RAGPipeline = require('./src/pipeline/ragPipeline');

const pipeline = new RAGPipeline({
  topK: 5,
  chunkSize: 1000,
  embeddingModel: 'text-embedding-3-small'
});

// Add documents
await pipeline.addDocuments(['./data/document1.pdf', './data/document2.txt']);

// Query
const result = await pipeline.query('Your question here');
console.log(result.response);
```

## Performance Considerations

1. **Embedding Generation**: Use batch processing for multiple documents
2. **Vector Store**: Consider using specialized vector databases for large datasets (Pinecone, Weaviate, Qdrant)
3. **Caching**: Implement Redis for embedding and response caching
4. **Rate Limiting**: Add rate limiting for production API usage
5. **Memory Management**: Monitor memory usage with large document sets

## Security Best Practices

1. **API Key Management**: Use environment variables and secure key rotation
2. **File Upload Validation**: Implement strict file type and size validation
3. **Input Sanitization**: Sanitize all user inputs
4. **Rate Limiting**: Implement request rate limiting
5. **Access Control**: Add authentication and authorization for production use

## Troubleshooting

### Common Issues:
1. **Memory errors**: Reduce chunk size or process documents in smaller batches
2. **API rate limits**: Implement exponential backoff and request queuing
3. **Poor retrieval quality**: Adjust similarity threshold and chunk overlap
4. **Slow responses**: Consider local embedding models or vector database optimization

### Performance Tuning:
- Experiment with different chunk sizes (500-2000 characters)
- Adjust similarity thresholds (0.6-0.8)
- Tune top-K values (3-10)
- Consider hybrid search combining semantic and keyword search

This implementation provides a complete, production-ready RAG pipeline that can be extended and customized for specific use cases.
