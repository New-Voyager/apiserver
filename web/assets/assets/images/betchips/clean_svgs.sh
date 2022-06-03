# svg cleaner - https://github.com/RazrFalcon/svgcleaner
for filename in `ls | grep .svg`;do svgcleaner $filename $filename; done
