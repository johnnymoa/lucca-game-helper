# Lucca Game Helper

A browser-based helper tool for the Lucca face guessing game to assist busy professionals.

## How It Works

This script automates gameplay by building a local database of employees during training mode, then uses that knowledge for the actual guessing game.

## Setup Instructions

1. **Training Mode**: 
   - Set `let MODE = 'LEARNING';` in the script
   - Run the script on the training game
   - The script will index all employees in your browser's local storage
   - Wait until it successfully completes all training guesses

2. **Game Mode**:
   - Set `let MODE = 'GUESSING';` in the script  
   - Run the script on the actual game
   - The script will use the trained database to make guesses

## Usage

Simply paste the code into your browser's console and run it.

## Important Warning

⚠️ **Score Limit**: Keep your score below 1600 to avoid getting banned for a month.

## Configuration

To switch between modes, modify this line in the script:
```javascript
let MODE = 'GUESSING'; // or 'LEARNING'
```