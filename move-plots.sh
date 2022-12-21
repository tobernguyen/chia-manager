#!/bin/bash

# Set the source directory from the first argument
src_dir=$1

# Shift the arguments to the left to remove the first argument (the source directory)
shift

# Set the destination directories from the remaining arguments
dst_dirs=("$@")

# Set the counter to 0
counter=0

# Iterate over the files
for file in "$src_dir"/*.plot; do
  # Get the current destination directory
  dst_dir=${dst_dirs[$counter]}

  # Get the base file name without the path
  # filename=$(basename "$file")
  echo "moving file ${file} to ${dst_dir}"

  # Move the file to the destination directory with the .tmp suffix
  rsync --remove-source-files --progress "$file" "$dst_dir"

  # Increment the counter
  ((counter++))

  # If the counter has reached the end of the array, set it back to 0
  if [ $counter -ge ${#dst_dirs[@]} ]; then
    counter=0
  fi
done
