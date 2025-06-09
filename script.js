window.faceGameBot = (() => {
    // Mode selection
    let MODE = 'GUESSING'; // 'LEARNING' or 'GUESSING'
    let roundNumber = 0;
    
    // SIMPLIFIED: Just hash->name mapping (1:1)
    let hashToName = {};
    let hashNegatives = {}; // Only for learning mode
    
    // Load data
    const savedData = JSON.parse(localStorage.getItem('faceGameDataV4') || '{}');
    hashToName = savedData.hashToName || {};
    hashNegatives = savedData.hashNegatives || {};
    
    console.log(`\n🚀 BOT STARTED`);
    console.log(`📊 Database: ${Object.keys(hashToName).length} people loaded`);
    console.log(`🎯 Mode: ${MODE}`);
    console.log(`ℹ️  Each person has exactly 1 image (1:1 mapping)\n`);
    
    // ULTRA-LEAN HASH - optimized for speed
    const fastCanvas = document.createElement('canvas');
    fastCanvas.width = 6;
    fastCanvas.height = 6;
    const fastCtx = fastCanvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false,
      desynchronized: true
    });
    
    // Cache for URL-based hashes (much faster for repeated images)
    const urlHashCache = new Map();
    
    function ultraLeanHash(imageUrl) {
      // First try URL-based hash (instant for repeated images)
      if (urlHashCache.has(imageUrl)) {
        return Promise.resolve(urlHashCache.get(imageUrl));
      }
      
      // Extract image ID from URL for super fast hashing
      const idMatch = imageUrl.match(/questions\/(\d+)\/picture/);
      if (idMatch) {
        const quickHash = `q${idMatch[1]}`;
        urlHashCache.set(imageUrl, quickHash);
        return Promise.resolve(quickHash);
      }
      
      // Fallback to image-based hash only if URL pattern doesn't work
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          fastCtx.drawImage(img, 0, 0, 6, 6);
          const data = fastCtx.getImageData(0, 0, 6, 6).data;
          
          let hash = '';
          for (let i = 0; i < data.length; i += 24) { // Larger steps for speed
            const val = ((data[i] + data[i+1] + data[i+2]) / 3) | 0;
            hash += (val >> 4).toString(16);
          }
          
          urlHashCache.set(imageUrl, hash);
          resolve(hash);
        };
        
        img.onerror = () => {
          const fallbackHash = imageUrl.slice(-16);
          urlHashCache.set(imageUrl, fallbackHash);
          resolve(fallbackHash);
        };
        
        img.src = imageUrl;
      });
    }
    
    // State tracking
    let currentImageUrl = '';
    let currentHash = '';
    let isProcessing = false;
    let sessionStats = { attempts: 0, correct: 0, newPeople: 0 };
    let pendingLearning = null; // Track what we're waiting to learn
    
    function saveData() {
      localStorage.setItem('faceGameDataV4', JSON.stringify({
        hashToName,
        hashNegatives
      }));
    }
    
    // FAST learning check - runs every few ms
    function checkForLearning() {
      if (!pendingLearning) return;
      
      const correctBtn = document.querySelector('.answer.is-right, .answer.palette-success');
      if (correctBtn) {
        const { hash, options, guessName, method } = pendingLearning;
        const correctName = correctBtn.textContent.trim();
        const wasCorrect = guessName === correctName;
        
        if (wasCorrect) sessionStats.correct++;
        
        console.log(`📋 Result: ${wasCorrect ? '✅ CORRECT' : '❌ WRONG'}`);
        console.log(`👤 Answer was: ${correctName}`);
        
        // Check if this is a new person
        const wasNewPerson = !hashToName[hash];
        
        // Update mapping
        hashToName[hash] = correctName;
        
        // Update negatives
        if (!hashNegatives[hash]) hashNegatives[hash] = [];
        options.forEach(name => {
          if (name !== correctName && !hashNegatives[hash].includes(name)) {
            hashNegatives[hash].push(name);
          }
        });
        
        if (wasNewPerson) {
          sessionStats.newPeople++;
          console.log(`🎉 NEW PERSON LEARNED: ${correctName} → ${hash}`);
          console.log(`📊 Database now has ${Object.keys(hashToName).length} people`);
        } else {
          console.log(`🔄 Reinforced: ${correctName} (already known)`);
        }
        
        // Since 1:1 mapping, eliminate this person from ALL other images
        Object.keys(hashNegatives).forEach(otherHash => {
          if (otherHash !== hash && !hashNegatives[otherHash].includes(correctName)) {
            hashNegatives[otherHash].push(correctName);
          }
        });
        
        console.log(`💡 Added ${options.length - 1} negative associations`);
        
        // LEARNING PROGRESSION STATS - Show every round
        const totalPeople = Object.keys(hashToName).length;
        const accuracy = ((sessionStats.correct / sessionStats.attempts) * 100).toFixed(1);
        console.log(`📈 LEARNING PROGRESS: ${totalPeople} people | Session: ${sessionStats.newPeople} new | Accuracy: ${accuracy}%`);
        
        // Show detailed progress every 10 rounds
        if (roundNumber % 10 === 0) {
          const totalNegatives = Object.values(hashNegatives).reduce((sum, arr) => sum + arr.length, 0);
          const avgNegatives = (totalNegatives / Math.max(1, totalPeople)).toFixed(1);
          
          console.log(`\n🔍 DETAILED PROGRESS (Round ${roundNumber}):`);
          console.log(`   📊 Total people in database: ${totalPeople}`);
          console.log(`   🆕 New people this session: ${sessionStats.newPeople}`);
          console.log(`   🎯 Session accuracy: ${accuracy}%`);
          console.log(`   ❌ Total negative associations: ${totalNegatives}`);
          console.log(`   📈 Average negatives per person: ${avgNegatives}`);
          console.log(`   🔄 Rounds played: ${roundNumber}`);
        }
        
        saveData();
        
        // Clear pending learning
        pendingLearning = null;
        isProcessing = false;
      }
    }
    
    // LEARNING MODE with immediate learning check
    async function learningModePlay() {
      // Don't start new round if still learning from previous
      if (isProcessing || pendingLearning) return;
      
      const imageDiv = document.querySelector('.image[style*="background-image"]');
      if (!imageDiv) return;
      
      const style = imageDiv.getAttribute('style');
      const match = style?.match(/url\("([^"]+)"\)/);
      if (!match || match[1] === currentImageUrl) return;
      
      isProcessing = true;
      currentImageUrl = match[1];
      currentHash = await ultraLeanHash(currentImageUrl);
      
      const buttons = Array.from(document.querySelectorAll('.answer:not(.has-answered)'));
      if (buttons.length === 0) {
        isProcessing = false;
        return;
      }
      
      roundNumber++;
      sessionStats.attempts++;
      
      console.log(`\n═══ ROUND ${roundNumber} ═══`);
      console.log(`📸 Hash: ${currentHash}`);
      
      const options = buttons.map(b => b.textContent.trim());
      console.log(`🎯 Options: [${options.join(', ')}]`);
      
      let buttonToClick = null;
      let method = '';
      let guessName = '';
      
      // Check if we know this image
      const knownName = hashToName[currentHash];
      if (knownName) {
        buttonToClick = buttons.find(b => b.textContent.trim() === knownName);
        if (buttonToClick) {
          method = 'KNOWN';
          guessName = knownName;
          console.log(`✅ Known person: ${knownName}`);
        }
      }
      
      // Smart guess with elimination
      if (!buttonToClick) {
        const negatives = new Set(hashNegatives[currentHash] || []);
        const alreadyKnownPeople = new Set(Object.values(hashToName));
        
        console.log(`🔍 Elimination:`);
        if (negatives.size > 0) {
          console.log(`   ❌ Known wrong for this image: [${Array.from(negatives).join(', ')}]`);
        }
        
        // Filter options
        const smartOptions = buttons.filter(b => {
          const name = b.textContent.trim();
          const isEliminated = negatives.has(name) || alreadyKnownPeople.has(name);
          if (isEliminated && alreadyKnownPeople.has(name)) {
            console.log(`   ❌ ${name} already assigned to another image`);
          }
          return !isEliminated;
        });
        
        if (smartOptions.length > 0) {
          buttonToClick = smartOptions[(Math.random() * smartOptions.length) | 0];
          method = 'SMART';
          guessName = buttonToClick.textContent.trim();
          console.log(`🤔 Smart guess from ${smartOptions.length} remaining options`);
        } else {
          buttonToClick = buttons[(Math.random() * buttons.length) | 0];
          method = 'RANDOM';
          guessName = buttonToClick.textContent.trim();
          console.log(`🎲 Random guess (all eliminated)`);
        }
      }
      
      console.log(`👉 Clicking: ${guessName} (${method})`);
      
      // Set up pending learning BEFORE clicking
      pendingLearning = {
        hash: currentHash,
        options: options,
        guessName: guessName,
        method: method
      };
      
      buttonToClick.click();
    }
    
    // GUESSING MODE - optimized for maximum speed
    let imageContainer = null;
    let mutationObserver = null;
    
    function initializeOptimizedGuessing() {
      // Cache the image container
      imageContainer = document.querySelector('.image-container .image') || 
                      document.querySelector('.image[style*="background-image"]');
      
      if (!imageContainer) {
        // Fallback if specific selector doesn't work
        setTimeout(initializeOptimizedGuessing, 100);
        return;
      }
      
      // Use MutationObserver for efficient change detection
      if (mutationObserver) mutationObserver.disconnect();
      
      mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            fastGuessingModePlay();
            break;
          }
        }
      });
      
      mutationObserver.observe(imageContainer, {
        attributes: true,
        attributeFilter: ['style']
      });
      
      console.log('🚀 Optimized guessing mode initialized with MutationObserver');
    }
    
    async function fastGuessingModePlay() {
      if (!imageContainer) return;
      
      // Direct style property access - much faster than getAttribute
      const backgroundImage = imageContainer.style.backgroundImage;
      if (!backgroundImage) return;
      
      // Extract URL more efficiently
      const urlMatch = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (!urlMatch || urlMatch[1] === currentImageUrl) return;
      
      currentImageUrl = urlMatch[1];
      const hash = await ultraLeanHash(currentImageUrl);
      
      const knownName = hashToName[hash];
      if (!knownName) return;
      
      // Cache button selector and use more efficient search
      const buttons = imageContainer.parentElement.parentElement.querySelectorAll('.answer:not(.has-answered)') ||
                     document.querySelectorAll('.answer:not(.has-answered)');
      
      // Use find for early exit instead of loop
      const targetButton = Array.from(buttons).find(b => b.textContent.trim() === knownName);
      
      if (targetButton) {
        targetButton.click();
        roundNumber++;
        sessionStats.attempts++;
        sessionStats.correct++;
        
        if (roundNumber % 50 === 0) {
          const accuracy = ((sessionStats.correct / sessionStats.attempts) * 100).toFixed(1);
          console.log(`⚡ GUESSING | Round ${roundNumber} | Accuracy: ${accuracy}% | Database: ${Object.keys(hashToName).length} people`);
        }
      }
    }
    
    async function guessingModePlay() {
      const imageDiv = document.querySelector('.image[style*="background-image"]');
      if (!imageDiv) return;
      
      const style = imageDiv.getAttribute('style');
      const match = style?.match(/url\("([^"]+)"\)/);
      if (!match || match[1] === currentImageUrl) return;
      
      currentImageUrl = match[1];
      const hash = await ultraLeanHash(currentImageUrl);
      
      const knownName = hashToName[hash];
      if (!knownName) return;
      
      const buttons = document.querySelectorAll('.answer:not(.has-answered)');
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.trim() === knownName) {
          buttons[i].click();
          roundNumber++;
          sessionStats.attempts++;
          sessionStats.correct++;
          
          if (roundNumber % 50 === 0) {
            const accuracy = ((sessionStats.correct / sessionStats.attempts) * 100).toFixed(1);
            console.log(`⚡ GUESSING | Round ${roundNumber} | Accuracy: ${accuracy}% | Database: ${Object.keys(hashToName).length} people`);
          }
          break;
        }
      }
    }
    
    // Mode-specific intervals
    let intervals = [];
    
    function startBot() {
      intervals.forEach(id => clearInterval(id));
      intervals = [];
      
      // Clean up mutation observer
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      
      roundNumber = 0;
      sessionStats = { attempts: 0, correct: 0, newPeople: 0 };
      pendingLearning = null;
      isProcessing = false;
      imageContainer = null;
      
      if (MODE === 'LEARNING') {
        // Main learning loop
        intervals.push(setInterval(learningModePlay, 100));
        // Fast learning check loop
        intervals.push(setInterval(checkForLearning, 10)); // Check every 10ms for results
        
        console.log('\n🎓 LEARNING MODE ACTIVE');
        console.log('Fast learning with negative elimination enabled!\n');
      } else {
        initializeOptimizedGuessing();
        
        console.log('\n⚡ GUESSING MODE ACTIVE');
        console.log('Maximum speed - MutationObserver + optimized DOM access\n');
      }
    }
    
    startBot();
    
    return {
      learning: () => {
        MODE = 'LEARNING';
        console.log('\n🔄 Switching to LEARNING MODE...');
        startBot();
      },
      
      guessing: () => {
        MODE = 'GUESSING';
        console.log('\n🔄 Switching to GUESSING MODE...');
        startBot();
      },
      
      stop: () => {
        intervals.forEach(id => clearInterval(id));
        MODE = 'STOPPED';
        pendingLearning = null;
        isProcessing = false;
        console.log('\n🛑 Bot stopped');
      },
      
      stats: () => {
        const totalPeople = Object.keys(hashToName).length;
        const totalNegatives = Object.values(hashNegatives).reduce((sum, arr) => sum + arr.length, 0);
        const accuracy = sessionStats.attempts > 0 ? ((sessionStats.correct / sessionStats.attempts) * 100).toFixed(1) : 'N/A';
        
        console.log(`\n📊 DATABASE STATS:`);
        console.log(`   People in database: ${totalPeople}`);
        console.log(`   Negative associations: ${totalNegatives}`);
        console.log(`   Average negatives per image: ${(totalNegatives / Math.max(1, totalPeople)).toFixed(1)}`);
        
        console.log(`\n📊 SESSION STATS:`);
        console.log(`   Rounds played: ${roundNumber}`);
        console.log(`   Accuracy: ${accuracy}%`);
        console.log(`   New people learned: ${sessionStats.newPeople}`);
      },
      
      clear: () => {
        if (confirm('Clear all learned data?')) {
          localStorage.removeItem('faceGameDataV4');
          hashToName = {};
          hashNegatives = {};
          urlHashCache.clear();
          roundNumber = 0;
          sessionStats = { attempts: 0, correct: 0, newPeople: 0 };
          pendingLearning = null;
          isProcessing = false;
          console.log('\n🗑️ All data cleared (including URL hash cache)');
        }
      },
      
      progress: () => {
        const total = Object.keys(hashToName).length;
        console.log(`\n📈 CURRENT PROGRESS: ${total} people in database`);
        
        if (pendingLearning) {
          console.log(`⏳ Currently learning from: ${pendingLearning.guessName}`);
        }
        
        // Show recent learns
        const recent = Object.entries(hashToName).slice(-5);
        if (recent.length > 0) {
          console.log('🕐 Recently learned:');
          recent.forEach(([hash, name]) => {
            console.log(`   ${name} → ${hash}`);
          });
        }
      },
      
      debug: () => {
        console.log(`\n🔧 DEBUG INFO:`);
        console.log(`   Current mode: ${MODE}`);
        console.log(`   URL hash cache size: ${urlHashCache.size}`);
        console.log(`   Image container cached: ${!!imageContainer}`);
        console.log(`   MutationObserver active: ${!!mutationObserver}`);
        console.log(`   Active intervals: ${intervals.length}`);
        console.log(`   Current image URL: ${currentImageUrl || 'None'}`);
        console.log(`   Processing state: ${isProcessing ? 'Busy' : 'Ready'}`);
        
        if (urlHashCache.size > 0) {
          console.log('\n🚀 URL HASH CACHE (last 5):');
          const cacheEntries = Array.from(urlHashCache.entries()).slice(-5);
          cacheEntries.forEach(([url, hash]) => {
            const shortUrl = url.split('/').slice(-2).join('/');
            console.log(`   ${shortUrl} → ${hash}`);
          });
        }
      }
    };
  })();