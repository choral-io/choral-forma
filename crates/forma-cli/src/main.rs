#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    forma_cli::run().await
}
