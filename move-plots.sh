#!/bin/bash

# Set the source and destination directories
src_dir=$1
dst_dir=$2

# Loop through all files in the source directory
for file in "$src_dir"/*.plot; do
  # Get the base file name without the path
  # filename=$(basename "$file")
  echo "moving file ${file}"

  # Move the file to the destination directory with the .tmp suffix
  rsync --remove-source-files "$file" "$dst_dir"
done
