const axios = require('axios')

async function testUnsplash() {
  const unsplashKey = 'YHnTWJR1vvH3xee-faQVhdCBCUrP93TtvSuRn92UkyI'
  const query = 'technology artificial intelligence'
  
  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: 1,
        orientation: 'landscape'
      },
      headers: {
        'Authorization': 'Client-ID ' + unsplashKey
      },
      timeout: 10000
    })
    
    if (response.data.results && response.data.results.length > 0) {
      const imageUrl = response.data.results[0].urls.regular
      console.log('Image URL:', imageUrl)
      console.log('SUCCESS')
      process.exit(0)
    } else {
      console.log('No images found')
      process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error.message)
    if (error.response) console.error('Response:', error.response.status, error.response.data)
    process.exit(1)
  }
}

testUnsplash()
