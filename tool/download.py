import os
import requests

def download_file(url, filename):
    response = requests.get(url)
    if response.status_code == 200:
        os.makedirs('static', exist_ok=True)
        with open(os.path.join('static', filename), 'wb') as f:
            f.write(response.content)
        print(f"Downloaded {filename}")
    else:
        print(f"Failed to download {filename}")

# 下载需要的库
download_file('https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.0.3/3Dmol-min.js', '3Dmol-min.js')
download_file('https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js', 'jquery.min.js')