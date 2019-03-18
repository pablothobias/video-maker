const algorithmia = require('algorithmia')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const sentenceBoundaryDetection = require('sbd')

async function robot(content) {
  await fetchContentFromWikipedia(content) //Pesquisa o conteúdo do wikipedia
  sanitizeContent(content) //Limpa o conteúdo retornado da busca
  breakContentIntoSentences(content) //Quebra o conteúdo retornado em frases

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
    content.setences = []

    const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
    sentences.forEach(sentence => {
      content.setences.push({
        text: sentence,
        keyword: [],
        images: []
      })
    })
  }
}

module.exports = robot
