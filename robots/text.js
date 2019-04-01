const algorithmia = require('algorithmia')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentenceBoundaryDetection = require('sbd')

const watsonApiKey = require('../credentials/watson-nlu.json').apikey
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');

const nlu = new NaturalLanguageUnderstandingV1({
  iam_apikey: watsonApiKey,
  version: '2018-04-05',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
});

const state = require('./state')

async function robot() {
  const content = state.load()
  await fetchContentFromWikipedia(content) //Pesquisa o conteúdo do wikipedia
  sanitizeContent(content) //Limpa o conteúdo retornado da busca
  breakContentIntoSentences(content) //Quebra o conteúdo retornado em frases
  limitMaximumSentences(content) //limita o numero de uso de frases no watson
  await fetchKeywordsOfAllSentences(content)

  state.save(content)

  async function fetchContentFromWikipedia(content) {
    const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey) //retorna uma instancia autenticada do algorithmia
    const wikipediaAlgorithm = algorithmiaAuthenticated.algo(
      "web/WikipediaParser/0.1.2"
    ) //retorna uma instancia do algoritimo do wikipedia
    const wikipediaResponse = await wikipediaAlgorithm.pipe(content.searchTerm); //retorna atraves de uma streaming do conteudo do wikipedia
    const wikipediaContent = wikipediaResponse.get() // retorna o conteudo do wikipedia de fato

    content.sourceContentOriginal = wikipediaContent.content
  }

  function sanitizeContent(content) {
    const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
    const withoutDateInParentheses = removeDateInParentheses(withoutBlankLinesAndMarkdown)

    content.sourceContentSanitized = withoutDateInParentheses

    function removeBlankLinesAndMarkdown(text) {
      const allLines = text.split("\n")

      const withoutBlankLinesAndMarkdown = allLines.filter(line => {
        if (line.trim().length === 0 || line.trim().startsWith("==")) return false
        return true
      });

      return withoutBlankLinesAndMarkdown.join(' ')
    }

    function removeDateInParentheses(text) {
      return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g, ' ')
    }
  }

  function breakContentIntoSentences(content) {
    content.sentences = []

    const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
    sentences.forEach(sentence => {
      content.sentences.push({
        text: sentence,
        keywords: [],
        images: []
      })
    })
  }

  function limitMaximumSentences(content) {
    content.sentences = content.sentences.splice(0, content.maximumSentences)
  }

  async function fetchKeywordsOfAllSentences(content) {
   for(const sentence of content.sentences) {
     sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)
   }
  }

  async function fetchWatsonAndReturnKeywords(sentence) {
    return new Promise((resolve, reject) => {
      nlu.analyze({
        text: sentence,
        features: {
          keywords: {}
        }
      }, (error, response) => {
        if (error) {
          throw error
        }

        const keywords = response.keywords.map(keyword => keyword.text)
        resolve(keywords)
      })
    })
  }
}

module.exports = robot
