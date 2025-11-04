"""
Utility script to generate password hashes for user database.
Run this script to generate new password hashes.
"""
import bcrypt

def generate_hash(password: str) -> str:
    """Generate bcrypt hash for a password."""
    # Convert password to bytes and generate hash
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

if __name__ == "__main__":
    # Generate hashes for default users
    users = {
        "admin": "admin123",
        "driver": "driver123",
        "parent": "parent123"
    }
    
    print("Generated password hashes:")
    print("=" * 80)
    
    for username, password in users.items():
        hashed = generate_hash(password)
        print(f"\nUsername: {username}")
        print(f"Password: {password}")
        print(f"Hash: {hashed}")
    
    print("\n" + "=" * 80)
    print("\nCopy these hashes to USERS_DB in app.py")
    print("\nTo generate a custom hash, use:")
    print('  python generate_hash.py "your_password_here"')
    
    # Allow custom password generation
    import sys
    if len(sys.argv) > 1:
        custom_password = sys.argv[1]
        custom_hash = generate_hash(custom_password)
        print(f"\nCustom password hash:")
        print(f"Password: {custom_password}")
        print(f"Hash: {custom_hash}")
