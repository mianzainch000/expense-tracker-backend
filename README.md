<!-- For Deployment
Mongo_Url or Port
Index.js or config/db.js mai jo code hai wo srif vercel par project upload karny ka liye hai
Index.js ko serveless b aisy liye baniya hai -->

# 1️⃣ Purana Git history delete karo

Remove-Item -Recurse -Force .git

# 2️⃣ Naya repo initialize karo

git init

# 3️⃣ Sab files stage aur commit karo

git add .
git commit -m "Initial commit"

# 4️⃣ Remote add karo

git remote add origin https://github.com/mianzainch000/expense-tracker-backend.git

# 5️⃣ Remote master branch par force push karo

git push -u origin master --force
