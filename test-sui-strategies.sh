#!/bin/bash

# Set the trading pair
PAIR="binance.SUI-USDT"

# Set simulation parameters
DAYS=5
PERIOD="15m"

# List of strategies to test
STRATEGIES=("macd" "trend_ema" "rsi" "cci_srsi" "momentum" "neural" "stddev")

echo "Starting strategy comparison for $PAIR over $DAYS days with $PERIOD period"
echo "========================================================================"

# Create results directory if it doesn't exist
mkdir -p strategy_comparison

# Create a summary file
SUMMARY_FILE="strategy_comparison/summary_${DAYS}d_${PERIOD}.txt"
echo "Strategy Comparison Summary for $PAIR ($DAYS days, $PERIOD period)" > $SUMMARY_FILE
echo "=======================================================================" >> $SUMMARY_FILE
echo "Strategy | Profit | Buy & Hold | vs. Buy Hold | Total Trades" >> $SUMMARY_FILE
echo "-----------------------------------------------------------------------" >> $SUMMARY_FILE

# Run simulations for each strategy
for STRATEGY in "${STRATEGIES[@]}"
do
  echo "Testing strategy: $STRATEGY"
  FILENAME="strategy_comparison/sui_${STRATEGY}_${DAYS}d_${PERIOD}.html"
  
  # Run simulation with verbose output
  echo "Running: NODE_OPTIONS=--max_old_space_size=8192 ./zenbot.sh sim $PAIR --days=$DAYS --period=$PERIOD --strategy=$STRATEGY --filename=$FILENAME"
  NODE_OPTIONS=--max_old_space_size=8192 ./zenbot.sh sim $PAIR --days=$DAYS --period=$PERIOD --strategy=$STRATEGY --filename=$FILENAME
  
  # Check if the HTML file was created
  if [ -f "$FILENAME" ]; then
    echo "HTML file created: $FILENAME"
    
    # Extract key metrics from the HTML file and save to a temporary file
    grep -A 20 "end balance" $FILENAME > temp_metrics.txt
    
    # Display the extracted metrics for debugging
    echo "Extracted metrics:"
    cat temp_metrics.txt
    
    # Extract specific metrics
    PROFIT=$(grep -o "end balance.*(" temp_metrics.txt | sed 's/.*(\(.*\))/\1/' | head -1)
    BUY_HOLD=$(grep -o "buy hold.*(" temp_metrics.txt | sed 's/.*(\(.*\))/\1/' | head -1)
    VS_HOLD=$(grep -o "vs. buy hold.*" temp_metrics.txt | sed 's/vs. buy hold: \(.*\)/\1/' | head -1)
    TRADES=$(grep -o "[0-9]* trades over" temp_metrics.txt | sed 's/ trades over//' | head -1)
    
    # Add to summary
    echo "$STRATEGY | $PROFIT | $BUY_HOLD | $VS_HOLD | $TRADES" >> $SUMMARY_FILE
    
    echo "  Profit: $PROFIT"
    echo "  Buy & Hold: $BUY_HOLD"
    echo "  vs. Buy & Hold: $VS_HOLD"
    echo "  Total Trades: $TRADES"
    echo "  Results saved to: $FILENAME"
  else
    echo "ERROR: HTML file was not created for strategy $STRATEGY"
    echo "$STRATEGY | ERROR | ERROR | ERROR | ERROR" >> $SUMMARY_FILE
  fi
  
  echo "----------------------------------------"
done

# Clean up
rm -f temp_metrics.txt

echo "Strategy comparison complete. Results saved to:"
echo "- Individual HTML reports in strategy_comparison directory"
echo "- Summary in $SUMMARY_FILE"

# Display the summary
echo ""
echo "SUMMARY OF RESULTS:"
echo "==================="
cat $SUMMARY_FILE