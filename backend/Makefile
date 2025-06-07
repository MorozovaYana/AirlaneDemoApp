CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -I/usr/include/postgresql
LDLIBS = -lpq
TARGET = airline_server
SRCS = main.cpp
OBJS = $(SRCS:.cpp=.o)

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDLIBS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(TARGET) $(OBJS)

run: $(TARGET)
	./$(TARGET)

docker-build:
	docker build -f ../Dockerfile.back

