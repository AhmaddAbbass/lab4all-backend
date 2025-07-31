#include <iostream>
#include <vector>
using namespace std;

void recursiveFunction(int n,vector<string>& t, int start, int intermediate, int destination) {
    if (n == 0) {
        return;
    }
    recursiveFunction(n-1,t ,start, destination, intermediate);
    t.push_back(to_string(start) + " " + to_string(destination));
    recursiveFunction(n-1,t,intermediate, destination, start);
}
int main(){
    int n ; 
    cin >> n ; 
    vector<string> s;
    recursiveFunction(n, s, 1, 2, 3);
    cout <<s.size() <<endl ; 
    for (int i = 0; i<s.size(); i++) {
        cout << s[i] << endl;
    }
    return 0;
}